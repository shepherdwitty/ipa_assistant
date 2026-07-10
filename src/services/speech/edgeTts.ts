/**
 * Edge TTS 客户端：请求本地/代理 /api/tts，返回可播放的 blob URL。
 * 失败时由 speakWord 回退到 Web Speech。
 */

const memoryUrlCache = new Map<string, string>()

/** 服务不可用时短暂跳过，避免每次单词都卡 数秒 */
let disabledUntil = 0

export type EdgeTtsOptions = {
  voice?: string
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

/**
 * 拉取单词 Edge TTS 音频，返回 object URL（已内存缓存）。
 */
export async function fetchEdgeTtsUrl(
  word: string,
  options?: EdgeTtsOptions,
): Promise<string> {
  const text = normalizeWord(word)
  if (!text) throw new Error('empty word')
  if (Date.now() < disabledUntil) {
    throw new Error('edge-tts temporarily disabled')
  }

  const voice = options?.voice || 'en-GB-SoniaNeural'
  const cacheKey = `${voice}::${text}`
  const hit = memoryUrlCache.get(cacheKey)
  if (hit) return hit

  const qs = new URLSearchParams({ text, voice })
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`/api/tts?${qs.toString()}`, { signal: ctrl.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`edge-tts ${res.status}: ${body.slice(0, 120)}`)
    }
    const blob = await res.blob()
    if (!blob.size) throw new Error('empty audio')
    const url = URL.createObjectURL(blob)
    memoryUrlCache.set(cacheKey, url)
    return url
  } catch (err) {
    // 网络/服务故障：30s 内不再重试
    disabledUntil = Date.now() + 30_000
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}
