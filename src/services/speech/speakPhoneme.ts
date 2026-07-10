import {
  DIPHTHONG_SEQUENCE,
  getPhonemeAudioUrl,
  PHONEME_AUDIO_FILE,
} from '../../data/phoneme-audio-map'
import { stripIpaSlashes } from '../../domain/phonemeSplit'

export type SpeakOptions = {
  /** 完整 IPA 场景传入单词时，用 TTS 读拼写（更自然） */
  word?: string | null
}

let currentAudio: HTMLAudioElement | null = null
let playToken = 0

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.removeAttribute('src')
    currentAudio.load()
    currentAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function playUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 注意：序列播放时不要在每段开头 cancel 掉自己的结束回调错乱
    if (currentAudio) {
      currentAudio.onended = null
      currentAudio.onerror = null
      currentAudio.pause()
      currentAudio.removeAttribute('src')
      currentAudio.load()
      currentAudio = null
    }

    const audio = new Audio(url)
    currentAudio = audio
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      resolve()
    }
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null
      reject(new Error(`audio load failed: ${url}`))
    }
    void audio.play().catch(reject)
  })
}

async function playFile(file: string): Promise<void> {
  await playUrl(getPhonemeAudioUrl(file))
}

async function playSequence(phonemes: string[], token: number): Promise<void> {
  for (let i = 0; i < phonemes.length; i++) {
    if (token !== playToken) return
    const p = phonemes[i]
    const file = PHONEME_AUDIO_FILE[p]
    if (!file) continue
    try {
      await playFile(file)
    } catch {
      /* skip missing segment */
    }
    if (token !== playToken) return
    if (i < phonemes.length - 1) {
      await new Promise((r) => setTimeout(r, 30))
    }
  }
}

function resolveAudioKey(raw: string): string | null {
  if (PHONEME_AUDIO_FILE[raw]) return raw
  if (raw.endsWith('ː')) {
    const short = raw.slice(0, -1)
    if (PHONEME_AUDIO_FILE[raw]) return raw
    if (PHONEME_AUDIO_FILE[short]) return short
    if (PHONEME_AUDIO_FILE[`${short}ː`]) return `${short}ː`
  }
  // g/ɡ 归一
  if (raw === 'g' && PHONEME_AUDIO_FILE['ɡ']) return 'ɡ'
  if (raw === 'ɡ' && PHONEME_AUDIO_FILE['g']) return 'g'
  return PHONEME_AUDIO_FILE[raw] ? raw : null
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  return (
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  )
}

/** 单词拼写 → 系统 TTS（仅用于「读单词」） */
export async function speakWord(word: string): Promise<void> {
  if (!word.trim()) return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  playToken += 1
  stopAudio()
  const text = word.trim()
  window.speechSynthesis.getVoices()

  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      try {
        window.speechSynthesis.resume()
      } catch {
        /* ignore */
      }
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 0.92
      utter.lang = 'en-GB'
      const voice = pickEnglishVoice()
      if (voice) {
        utter.voice = voice
        utter.lang = voice.lang
      }
      utter.onend = () => resolve()
      utter.onerror = () => resolve()
      window.speechSynthesis.speak(utter)
    }, 40)
  })
}

/**
 * 朗读音标：只播录音文件。
 * - 单音素 / 已知双元音：一段（或双元音两段串播）
 * - 完整 IPA + word：TTS 读单词
 * - 斜杠等定界符一律忽略，不会当成「音」
 */
export async function speakPhoneme(
  phoneme: string,
  options?: SpeakOptions,
): Promise<void> {
  // 彻底去掉 / [ ] 等，斜杠绝不会进入切分
  const raw = stripIpaSlashes(phoneme)
  const token = ++playToken
  stopAudio()

  // 读单词（完整音标旁的胶囊 / 显式 word）
  if (options?.word?.trim()) {
    const key = resolveAudioKey(raw)
    // 仅当 raw 本身就是「一个」音素时播音素；否则（完整 IPA）读单词
    if (!key || raw.length > 3) {
      await speakWord(options.word)
      return
    }
  }

  if (!raw) return

  // 1) 单音素 / 双元音整段：只播一个文件（eɪ → ei.mp3，不拆成 e+i）
  const key = resolveAudioKey(raw)
  if (key && PHONEME_AUDIO_FILE[key]) {
    try {
      await playFile(PHONEME_AUDIO_FILE[key])
      return
    } catch {
      /* fall through */
    }
  }

  // 2) 双元音兜底：仅当整段文件缺失时才串播
  const seq = DIPHTHONG_SEQUENCE[raw]
  if (seq) {
    console.warn('[speakPhoneme] diphthong file missing, fallback sequence', raw)
    await playSequence(seq, token)
    return
  }

  // 3) 完整 IPA 串且无 word：才串播（如 /ɡʊd/ → ɡ+ʊ+d）
  //    单音素绝不应落到这里
  if (raw.length > 1 && !resolveAudioKey(raw) && !DIPHTHONG_SEQUENCE[raw]) {
    const units = Object.keys(PHONEME_AUDIO_FILE).sort((a, b) => b.length - a.length)
    const parts: string[] = []
    let i = 0
    while (i < raw.length) {
      const ch = raw[i]
      if (ch === 'ˈ' || ch === 'ˌ' || ch === '.' || ch === '/' || ch === '／') {
        i += 1
        continue
      }
      let hit = false
      for (const u of units) {
        if (raw.startsWith(u, i)) {
          parts.push(u)
          i += u.length
          hit = true
          break
        }
      }
      if (!hit) i += 1
    }
    // 只有解析出多段时才串播；1 段当单音素
    if (parts.length === 1 && PHONEME_AUDIO_FILE[parts[0]]) {
      try {
        await playFile(PHONEME_AUDIO_FILE[parts[0]])
        return
      } catch {
        /* fall through */
      }
    }
    if (parts.length > 1) {
      await playSequence(parts, token)
      return
    }
  }

  console.warn('[speakPhoneme] no audio for', JSON.stringify(phoneme), '→', JSON.stringify(raw))
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

export function warmupSpeech(): void {
  if (typeof window === 'undefined') return
  const warm = ['f', 'ʃ', 'ʊ', 'iː', 'ə', 'tʃ', 'p', 's', 'tr', 'eɪ', 'θ']
  for (const p of warm) {
    const file = PHONEME_AUDIO_FILE[p]
    if (!file) continue
    const a = new Audio()
    a.preload = 'auto'
    a.src = getPhonemeAudioUrl(file)
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices()
  }
}
