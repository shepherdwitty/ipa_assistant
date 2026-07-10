import { describe, expect, it } from 'vitest'
import {
  assertChina48Coverage,
  CHINA_48_PHONEMES,
  getPhonemeAudioUrl,
  PHONEME_AUDIO_FILE,
} from './phoneme-audio-map'

describe('China-48 phoneme audio map', () => {
  it('covers all 48 teaching phonemes', () => {
    expect(CHINA_48_PHONEMES).toHaveLength(48)
    expect(assertChina48Coverage()).toEqual([])
  })

  it('uses unique case-insensitive-safe filenames for key pairs', () => {
    const files = CHINA_48_PHONEMES.map((p) => PHONEME_AUDIO_FILE[p].toLowerCase())
    expect(new Set(files).size).toBe(48)
    // tʃ / ts and dʒ / dz must not collide on macOS default FS
    expect(PHONEME_AUDIO_FILE['tʃ']).not.toBe(PHONEME_AUDIO_FILE['ts'])
    expect(PHONEME_AUDIO_FILE['dʒ']).not.toBe(PHONEME_AUDIO_FILE['dz'])
    expect(PHONEME_AUDIO_FILE['tʃ'].toLowerCase()).not.toBe(
      PHONEME_AUDIO_FILE['ts'].toLowerCase(),
    )
    expect(PHONEME_AUDIO_FILE['dʒ'].toLowerCase()).not.toBe(
      PHONEME_AUDIO_FILE['dz'].toLowerCase(),
    )
  })

  it('resolves phoneme audio as root-absolute path (nested SPA routes safe)', () => {
    const url = getPhonemeAudioUrl('n.mp3')
    // 不能是 ./phonemes/...，否则 /word/:id 下会变成 /word/phonemes/...
    expect(url.startsWith('./')).toBe(false)
    expect(url).toMatch(/(^|\/)phonemes\/n\.mp3$/)
    expect(url.includes('/word/')).toBe(false)
  })
})
