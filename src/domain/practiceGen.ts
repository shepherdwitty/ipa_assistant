import type { GraphemePhonemeMap, WordRecord } from '../db/schema'
import { isAlignmentUnitReliable } from './alignGrapheme'

export type PracticeKind = 'phoneme-find' | 'pair-match'

export interface PhonemeFindQuestion {
  kind: 'phoneme-find'
  phoneme: string
  options: WordRecord[]
  correctIds: string[]
}

export interface PairMatchQuestion {
  kind: 'pair-match'
  word: WordRecord
  graphemes: string[]
  phonemes: string[]
  /** grapheme -> phoneme correct mapping（grapheme / phoneme 均唯一） */
  pairs: Array<{ grapheme: string; phoneme: string }>
}

export type PracticeQuestion = PhonemeFindQuestion | PairMatchQuestion

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generatePhonemeFind(
  words: WordRecord[],
  phonemeToWordIds: Map<string, string[]>,
): PhonemeFindQuestion | null {
  const usable = [...phonemeToWordIds.entries()].filter(([, ids]) => ids.length >= 1)
  if (usable.length === 0 || words.length < 2) return null

  const [phoneme, correctIds] = usable[Math.floor(Math.random() * usable.length)]
  const correctSet = new Set(correctIds)
  const correctWords = words.filter((w) => correctSet.has(w.id))
  const distractors = shuffle(words.filter((w) => !correctSet.has(w.id))).slice(0, 3)
  const pickCorrect = shuffle(correctWords).slice(0, Math.min(2, correctWords.length))
  const options = shuffle([...pickCorrect, ...distractors]).slice(0, 4)

  if (options.length < 2) return null

  return {
    kind: 'phoneme-find',
    phoneme,
    options,
    correctIds: options.filter((o) => correctSet.has(o.id)).map((o) => o.id),
  }
}

/** 练习用配对：与 isAlignmentUnitReliable 同一套门槛，杜绝吞音废题 */
export function isPracticePair(m: GraphemePhonemeMap): boolean {
  if (/^[ʰʲʷˈˌ.\s]+$/.test(m.phoneme)) return false
  return isAlignmentUnitReliable(m)
}

/**
 * 从词的音形映射里挑练习配对：
 * 1. 字母组合、音标都唯一（UI 用字符串做 key，重复 e/i/t 会串台）
 * 2. 优先多字母组合（digraph），再高置信度，再靠前位置
 * 3. 最多 5 对
 */
export function selectPracticePairs(
  maps: GraphemePhonemeMap[],
  maxPairs = 5,
): Array<{ grapheme: string; phoneme: string }> {
  const usable = maps.filter(isPracticePair)
  const sorted = [...usable].sort((a, b) => {
    if (b.grapheme.length !== a.grapheme.length) return b.grapheme.length - a.grapheme.length
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.startIndex - b.startIndex
  })

  const seenG = new Set<string>()
  const seenP = new Set<string>()
  const pairs: Array<{ grapheme: string; phoneme: string }> = []

  for (const m of sorted) {
    if (seenG.has(m.grapheme) || seenP.has(m.phoneme)) continue
    seenG.add(m.grapheme)
    seenP.add(m.phoneme)
    pairs.push({ grapheme: m.grapheme, phoneme: m.phoneme })
    if (pairs.length >= maxPairs) break
  }

  return pairs
}

/**
 * 拆解配对出题：
 * - 候选 = 至少 2 条可用且可去重后仍够 2 对的词
 * - 均匀随机；可选 excludeWordId 避免连出同一词
 */
export function generatePairMatch(
  words: WordRecord[],
  mapsByWordId: Map<string, GraphemePhonemeMap[]>,
  excludeWordId?: string | null,
): PairMatchQuestion | null {
  let candidates = words.filter((w) => {
    const maps = mapsByWordId.get(w.id) ?? []
    return selectPracticePairs(maps).length >= 2
  })
  if (candidates.length === 0) return null

  if (excludeWordId && candidates.length > 1) {
    const without = candidates.filter((w) => w.id !== excludeWordId)
    if (without.length > 0) candidates = without
  }

  const word = shuffle(candidates)[0]
  const pairs = selectPracticePairs(mapsByWordId.get(word.id) ?? [])
  if (pairs.length < 2) return null

  return {
    kind: 'pair-match',
    word,
    graphemes: shuffle(pairs.map((p) => p.grapheme)),
    phonemes: shuffle(pairs.map((p) => p.phoneme)),
    pairs,
  }
}

export function checkPhonemeFind(
  q: PhonemeFindQuestion,
  selectedIds: string[],
): boolean {
  const a = [...selectedIds].sort().join(',')
  const b = [...q.correctIds].sort().join(',')
  return a === b
}

export function checkPairMatch(
  q: PairMatchQuestion,
  userPairs: Array<{ grapheme: string; phoneme: string }>,
): boolean {
  if (userPairs.length !== q.pairs.length) return false
  const key = (p: { grapheme: string; phoneme: string }) => `${p.grapheme}|${p.phoneme}`
  const expected = new Set(q.pairs.map(key))
  return userPairs.every((p) => expected.has(key(p)))
}
