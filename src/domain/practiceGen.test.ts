import { describe, expect, it } from 'vitest'
import { CHINA_48_PHONEMES } from '../data/phoneme-audio-map'
import type { GraphemePhonemeMap } from '../db/schema'
import {
  checkListenChoose,
  generateListenChoose,
  generateListenChooseSession,
  LISTEN_CHOOSE_SESSION_SIZE,
  pickListenChooseDistractors,
  selectPracticePairs,
} from './practiceGen'

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

describe('listen-choose', () => {
  it('picks 3 distractors without the answer', () => {
    for (const answer of ['iː', 'θ', 'tʃ', 'ŋ'] as const) {
      const d = pickListenChooseDistractors(answer, 3)
      expect(d).toHaveLength(3)
      expect(new Set(d).size).toBe(3)
      expect(d.includes(answer)).toBe(false)
      for (const p of d) {
        expect(CHINA_48_PHONEMES.includes(p as (typeof CHINA_48_PHONEMES)[number])).toBe(
          true,
        )
      }
    }
  })

  it('generates a 4-option question including the answer', () => {
    const q = generateListenChoose('ʃ')
    expect(q.kind).toBe('listen-choose')
    expect(q.answer).toBe('ʃ')
    expect(q.options).toHaveLength(4)
    expect(new Set(q.options).size).toBe(4)
    expect(q.options).toContain('ʃ')
  })

  it('builds a 30-question session with unique answers', () => {
    const session = generateListenChooseSession()
    expect(session).toHaveLength(LISTEN_CHOOSE_SESSION_SIZE)
    const answers = session.map((q) => q.answer)
    expect(new Set(answers).size).toBe(LISTEN_CHOOSE_SESSION_SIZE)
    for (const q of session) {
      expect(q.options).toHaveLength(4)
      expect(q.options).toContain(q.answer)
      expect(checkListenChoose(q, q.answer)).toBe(true)
      expect(checkListenChoose(q, q.options.find((o) => o !== q.answer))).toBe(false)
    }
  })
})
