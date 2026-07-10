import { describe, expect, it } from 'vitest'
import { splitPhonemes } from './phonemeSplit'

describe('splitPhonemes', () => {
  it('splits phone ipa', () => {
    expect(splitPhonemes('/fəʊn/')).toEqual(['f', 'əʊ', 'n'])
  })

  it('handles affricates and long vowels', () => {
    expect(splitPhonemes('/tʃeə/')).toEqual(['tʃ', 'eə'])
    expect(splitPhonemes('/ɡriːn/')).toEqual(['ɡ', 'r', 'iː', 'n'])
  })

  it('handles China-48 extensions ts/dz/tr/dr', () => {
    expect(splitPhonemes('/kæts/')).toEqual(['k', 'æ', 'ts'])
    expect(splitPhonemes('/bedz/')).toEqual(['b', 'e', 'dz'])
    expect(splitPhonemes('/triː/')).toEqual(['tr', 'iː'])
    expect(splitPhonemes('/drɪŋk/')).toEqual(['dr', 'ɪ', 'ŋ', 'k'])
  })

  it('keeps choice diphthong as one unit for both ɔɪ and oɪ', () => {
    expect(splitPhonemes('/pɔɪnt/')).toEqual(['p', 'ɔɪ', 'n', 't'])
    expect(splitPhonemes('/poɪnt/')).toEqual(['p', 'oɪ', 'n', 't'])
  })
})
