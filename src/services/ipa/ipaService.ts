import { lookupSeedIpa } from '../../data/seed-ipa-dict'
import { arpabetToIpa } from '../../domain/arpabetToIpa'
import { normalizeTeachingIpa } from '../../domain/normalizeIpa'
import type { IpaProvider, IpaResult } from './types'

function pickBestPhonetic(
  phonetics: Array<{ text?: string; audio?: string }>,
  fallback?: string,
): string | null {
  const withText = phonetics.filter((p) => p.text?.trim())

  // 1) 英式音频 + 文本
  const uk = withText.find((p) => p.audio?.includes('-uk'))
  if (uk?.text) return uk.text

  // 2) 不含明显美式倒 r / 卷舌符的文本
  const clean = withText.find((p) => {
    const t = p.text ?? ''
    return !/[ɹɻɚɝ]/.test(t) && !p.audio?.includes('-us')
  })
  if (clean?.text) return clean.text

  // 3) 任意文本 / entry.phonetic
  if (withText[0]?.text) return withText[0].text
  if (fallback?.trim()) return fallback
  return null
}

/** Free Dictionary API — 许多词 phonetics 为空（如 project） */
async function lookupDictionaryApi(word: string): Promise<IpaResult | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      phonetic?: string
      phonetics?: Array<{ text?: string; audio?: string }>
      word?: string
    }>
    if (!Array.isArray(data) || data.length === 0) return null

    // 遍历多条义项，有的 entry 有音标、有的没有
    for (const entry of data) {
      const picked = pickBestPhonetic(entry.phonetics ?? [], entry.phonetic)
      if (picked) {
        return {
          ipa: normalizeTeachingIpa(picked),
          syllables: null,
          source: 'api',
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Datamuse 回退：返回 ARPAbet 发音标签，再转教学 IPA。
 * Free Dictionary 对 project 等词 phonetics=[] 时很有用。
 */
async function lookupDatamuse(word: string): Promise<IpaResult | null> {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word.toLowerCase())}&md=r&max=5`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ word?: string; tags?: string[] }>
    if (!Array.isArray(data)) return null

    const exact =
      data.find((d) => d.word?.toLowerCase() === word.toLowerCase()) ?? data[0]
    const tags = exact?.tags ?? []
    const pronTag = tags.find((t) => t.startsWith('pron:'))
    if (!pronTag) return null

    const ipa = arpabetToIpa(pronTag)
    if (!ipa) return null
    return {
      ipa: normalizeTeachingIpa(ipa),
      syllables: null,
      source: 'api',
    }
  } catch {
    return null
  }
}

export const ipaService: IpaProvider = {
  async lookup(word: string): Promise<IpaResult> {
    const seed = lookupSeedIpa(word)
    if (seed) {
      return {
        ipa: normalizeTeachingIpa(seed.ipa),
        syllables: seed.syllables ?? null,
        source: 'builtin',
      }
    }

    const api = await lookupDictionaryApi(word)
    if (api) return api

    const dm = await lookupDatamuse(word)
    if (dm) return dm

    return { ipa: '', syllables: null, source: 'none' }
  },
}
