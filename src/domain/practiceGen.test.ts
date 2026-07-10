import { describe, expect, it } from 'vitest'
import type { GraphemePhonemeMap } from '../db/schema'
import { selectPracticePairs } from './practiceGen'

function map(
  grapheme: string,
  phoneme: string,
  startIndex: number,
  confidence = 0.75,
): GraphemePhonemeMap {
  return {
    id: `${grapheme}_${startIndex}`,
    wordId: 'w1',
    grapheme,
    phoneme,
    startIndex,
    endIndex: startIndex + grapheme.length,
    confidence,
  }
}

describe('selectPracticePairs', () => {
  it('dedupes repeated graphemes and phonemes', () => {
    const pairs = selectPracticePairs([
      map('a', 'æ', 0),
      map('c', 'k', 1),
      map('t', 't', 2),
      map('i', 'ɪ', 3),
      map('v', 'v', 4),
      map('i', 'ə', 5), // 重复 grapheme i
      map('t', 't', 6), // 重复 grapheme t + 重复 phoneme t
      map('y', 'i', 7),
    ])
    const graphemes = pairs.map((p) => p.grapheme)
    const phonemes = pairs.map((p) => p.phoneme)
    expect(new Set(graphemes).size).toBe(graphemes.length)
    expect(new Set(phonemes).size).toBe(phonemes.length)
    expect(graphemes.filter((g) => g === 'i')).toHaveLength(1)
  })

  it('prefers digraphs over single letters', () => {
    const pairs = selectPracticePairs([
      map('r', 'r', 0),
      map('e', 'ɪ', 1),
      map('c', 's', 2),
      map('ei', 'iː', 3, 0.9),
      map('v', 'v', 5),
    ])
    expect(pairs.some((p) => p.grapheme === 'ei' && p.phoneme === 'iː')).toBe(true)
    expect(pairs.every((p) => p.grapheme !== 'e' || p.phoneme !== 'iː')).toBe(true)
  })
})
