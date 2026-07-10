import { describe, expect, it } from 'vitest'
import { normalizeTeachingIpa } from './normalizeIpa'

describe('normalizeTeachingIpa', () => {
  it('turns inverted r into plain r', () => {
    expect(normalizeTeachingIpa('/ɻer/')).toBe('/rer/')
    expect(normalizeTeachingIpa('/ɹeə/')).toBe('/reə/')
  })

  it('normalizes americanisms used for rare-like forms', () => {
    expect(normalizeTeachingIpa('[ɻeɹ]')).toBe('/rer/')
    expect(normalizeTeachingIpa('/ˈɻeəɹ/')).toBe('/reər/')
  })

  it('maps r-colored vowels', () => {
    expect(normalizeTeachingIpa('/fɑːðɚ/')).toBe('/fɑːðə/')
  })

  it('strips aspiration superscript h', () => {
    expect(normalizeTeachingIpa('/wɒntʰɪd/')).toBe('/wɒntɪd/')
  })

  it('maps Free Dictionary oɪ diphthong to teaching ɔɪ', () => {
    // appointee 等词 API 常返回 /əˌpoɪnˈtiː/
    expect(normalizeTeachingIpa('/əˌpoɪnˈtiː/')).toBe('/əpɔɪntiː/')
    expect(normalizeTeachingIpa('/poɪnt/')).toBe('/pɔɪnt/')
  })

  it('maps academic ɛ to teaching e', () => {
    // comment 等词 API 常返回 /ˈkɒmɛnt/
    expect(normalizeTeachingIpa('/ˈkɒmɛnt/')).toBe('/kɒment/')
  })

  it('unwraps optional phonemes in parentheses', () => {
    // history: Free Dictionary /ˈhɪst(ə)ɹi/
    expect(normalizeTeachingIpa('/ˈhɪst(ə)ɹi/')).toBe('/hɪstəri/')
    expect(normalizeTeachingIpa('/ˈhɪst(ə)ri/')).toBe('/hɪstəri/')
  })
})
