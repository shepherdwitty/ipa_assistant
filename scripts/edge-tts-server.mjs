/**
 * 薄 Edge TTS 代理：供前端 /api/tts 使用。
 * 基于社区 node-edge-tts（Microsoft Edge 神经语音，best-effort，无 SLA）。
 *
 * GET /api/tts?text=apple&voice=en-GB-SoniaNeural
 * → audio/mpeg
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { EdgeTTS } from 'node-edge-tts'

const PORT = Number(process.env.TTS_PORT || 8787)
const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-GB-SoniaNeural'
const DEFAULT_LANG = process.env.TTS_LANG || 'en-GB'
const MAX_TEXT = 80
const CACHE_DIR = path.join(os.tmpdir(), 'ipa-edge-tts-cache')
const memoryCache = new Map() // key -> Buffer

fs.mkdirSync(CACHE_DIR, { recursive: true })

const tts = new EdgeTTS({
  voice: DEFAULT_VOICE,
  lang: DEFAULT_LANG,
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  rate: '-5%',
  timeout: 15000,
})

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function cacheKey(text, voice) {
  return crypto.createHash('sha1').update(`${voice}::${text}`).digest('hex')
}

function sanitizeText(raw) {
  return String(raw || '')
    .trim()
    .slice(0, MAX_TEXT)
    .replace(/[^\p{L}\p{N}\s'\-.]/gu, '')
}

async function synthesize(text, voice) {
  const key = cacheKey(text, voice)
  if (memoryCache.has(key)) return memoryCache.get(key)

  const diskPath = path.join(CACHE_DIR, `${key}.mp3`)
  if (fs.existsSync(diskPath)) {
    const buf = fs.readFileSync(diskPath)
    memoryCache.set(key, buf)
    return buf
  }

  const engine =
    voice === DEFAULT_VOICE
      ? tts
      : new EdgeTTS({
          voice,
          lang: voice.startsWith('en-US') ? 'en-US' : 'en-GB',
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          rate: '-5%',
          timeout: 15000,
        })

  const tmpPath = path.join(CACHE_DIR, `${key}.${process.pid}.tmp.mp3`)
  await engine.ttsPromise(text, tmpPath)
  fs.renameSync(tmpPath, diskPath)
  const buf = fs.readFileSync(diskPath)
  memoryCache.set(key, buf)
  return buf
}

const server = http.createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, voice: DEFAULT_VOICE }))
    return
  }

  if (url.pathname !== '/api/tts' && url.pathname !== '/tts') {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
    return
  }

  const text = sanitizeText(url.searchParams.get('text') || '')
  const voice = (url.searchParams.get('voice') || DEFAULT_VOICE).trim()

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
    console.log(`[tts] "${text}" → ${buf.length}B ${Date.now() - t0}ms (${voice})`)
  } catch (err) {
    console.error('[tts] fail', text, err)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'tts failed', message: String(err?.message || err) }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[edge-tts] http://0.0.0.0:${PORT}/api/tts?text=apple`)
  console.log(`[edge-tts] default voice: ${DEFAULT_VOICE}`)
  console.log(`[edge-tts] cache: ${CACHE_DIR}`)
})
