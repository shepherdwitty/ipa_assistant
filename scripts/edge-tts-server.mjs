/**
 * 薄 Edge TTS 代理（+ 可选静态资源，供 Electron 生产环境同源加载）。
 *
 * GET /api/tts?text=apple&voice=en-GB-SoniaNeural → audio/mpeg
 * GET /health → { ok: true }
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { EdgeTTS } from 'node-edge-tts'

const DEFAULT_PORT = Number(process.env.TTS_PORT || 17322)
const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-GB-SoniaNeural'
const DEFAULT_LANG = process.env.TTS_LANG || 'en-GB'
const MAX_TEXT = 80

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sanitizeText(raw) {
  return String(raw || '')
    .trim()
    .slice(0, MAX_TEXT)
    .replace(/[^\p{L}\p{N}\s'\-.]/gu, '')
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  }
  return map[ext] || 'application/octet-stream'
}

/**
 * @param {{
 *   port?: number
 *   host?: string
 *   voice?: string
 *   lang?: string
 *   cacheDir?: string
 *   staticDir?: string | null
 *   quiet?: boolean
 * }} [options]
 * @returns {Promise<http.Server>}
 */
export function startTtsServer(options = {}) {
  const port = Number(options.port || DEFAULT_PORT)
  const host = options.host || '127.0.0.1'
  const voiceDefault = options.voice || DEFAULT_VOICE
  const langDefault = options.lang || DEFAULT_LANG
  const cacheDir =
    options.cacheDir || path.join(os.tmpdir(), 'ipa-edge-tts-cache')
  const staticDir = options.staticDir
    ? path.resolve(options.staticDir)
    : null
  const quiet = Boolean(options.quiet)
  const memoryCache = new Map()

  fs.mkdirSync(cacheDir, { recursive: true })

  const tts = new EdgeTTS({
    voice: voiceDefault,
    lang: langDefault,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: '-5%',
    timeout: 15000,
  })

  function cacheKey(text, voice) {
    return crypto.createHash('sha1').update(`${voice}::${text}`).digest('hex')
  }

  async function synthesize(text, voice) {
    const key = cacheKey(text, voice)
    if (memoryCache.has(key)) return memoryCache.get(key)

    const diskPath = path.join(cacheDir, `${key}.mp3`)
    if (fs.existsSync(diskPath)) {
      const buf = fs.readFileSync(diskPath)
      memoryCache.set(key, buf)
      return buf
    }

    const engine =
      voice === voiceDefault
        ? tts
        : new EdgeTTS({
            voice,
            lang: voice.startsWith('en-US') ? 'en-US' : 'en-GB',
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            rate: '-5%',
            timeout: 15000,
          })

    const tmpPath = path.join(cacheDir, `${key}.${process.pid}.tmp.mp3`)
    await engine.ttsPromise(text, tmpPath)
    fs.renameSync(tmpPath, diskPath)
    const buf = fs.readFileSync(diskPath)
    memoryCache.set(key, buf)
    return buf
  }

  function tryServeStatic(reqPath, res) {
    if (!staticDir) return false

    let rel = decodeURIComponent(reqPath.split('?')[0] || '/')
    if (rel === '/') rel = '/index.html'
    // 防目录穿越
    const abs = path.normalize(path.join(staticDir, rel))
    if (!abs.startsWith(staticDir)) {
      res.writeHead(403)
      res.end('forbidden')
      return true
    }

    let file = abs
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // SPA fallback
      file = path.join(staticDir, 'index.html')
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404)
      res.end('not found')
      return true
    }

    res.writeHead(200, { 'Content-Type': contentType(file) })
    fs.createReadStream(file).pipe(res)
    return true
  }

  const server = http.createServer(async (req, res) => {
    cors(res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${host}:${port}`)

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, voice: voiceDefault }))
      return
    }

    if (url.pathname === '/api/tts' || url.pathname === '/tts') {
      const text = sanitizeText(url.searchParams.get('text') || '')
      const voice = (url.searchParams.get('voice') || voiceDefault).trim()

      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'missing text' }))
        return
      }

      try {
        const t0 = Date.now()
        const buf = await synthesize(text, voice)
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=86400',
          'X-TTS-Voice': voice,
          'X-TTS-Ms': String(Date.now() - t0),
        })
        res.end(buf)
        if (!quiet) {
          console.log(
            `[tts] "${text}" → ${buf.length}B ${Date.now() - t0}ms (${voice})`,
          )
        }
      } catch (err) {
        console.error('[tts] fail', text, err)
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: 'tts failed',
            message: String(err?.message || err),
          }),
        )
      }
      return
    }

    if (tryServeStatic(url.pathname, res)) return

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      if (!quiet) {
        console.log(`[edge-tts] http://${host}:${port}/api/tts?text=apple`)
        console.log(`[edge-tts] default voice: ${voiceDefault}`)
        console.log(`[edge-tts] cache: ${cacheDir}`)
        if (staticDir) console.log(`[edge-tts] static: ${staticDir}`)
      }
      resolve(server)
    })
  })
}

// CLI: node scripts/edge-tts-server.mjs
const isCli =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])

if (isCli) {
  startTtsServer({
    port: DEFAULT_PORT,
    host: process.env.TTS_HOST || '0.0.0.0',
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
