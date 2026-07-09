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
})
