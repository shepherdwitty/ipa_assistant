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
})
