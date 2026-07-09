import { describe, expect, it } from 'vitest'
import { extractWordsFromText, normalizeWord, parseManualWords } from './wordClean'

describe('wordClean', () => {
  it('normalizes case and punctuation', () => {
    expect(normalizeWord('Phone')).toBe('phone')
    expect(normalizeWord("don't")).toBe('dont')
  })

  it('extracts english words and dedupes', () => {
    const words = extractWordsFromText('Phone phone FISH 中文 123 ship!')
    expect(words.map((w) => w.word).sort()).toEqual(['fish', 'phone', 'ship'])
  })

  it('parses manual input with chinese separators', () => {
    expect(parseManualWords('phone，fish、ship')).toEqual(['phone', 'fish', 'ship'])
  })
})
