import type { GraphemePhonemeMap, WordRecord } from '../db/schema'

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
  /** grapheme -> phoneme correct mapping */
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

/** 练习用配对：过滤低置信度 / 装饰碎片 / 空音标，避免出「e→/ʰ/」这种废题 */
function isPracticePair(m: GraphemePhonemeMap): boolean {
  if (!m.grapheme || !m.phoneme) return false
  if (m.confidence < 0.55) return false
  // 纯上标/装饰不能当音标选项
  if (/^[ʰʲʷˈˌ.\s]+$/.test(m.phoneme)) return false
  // 音标过短且非常见单音素时跳过
  if (m.phoneme.length === 0) return false
  return true
}

/**
 * 拆解配对出题：
 * - 候选 = 至少 2 条可用音形映射的词
 * - 在候选中**均匀随机**（不再 60% 锁死 digraph 最多的词）
 * - 可选 excludeWordId，避免连出同一词
 */
export function generatePairMatch(
  words: WordRecord[],
  mapsByWordId: Map<string, GraphemePhonemeMap[]>,
  excludeWordId?: string | null,
): PairMatchQuestion | null {
  let candidates = words.filter((w) => {
    const maps = mapsByWordId.get(w.id) ?? []
    return maps.filter(isPracticePair).length >= 2
  })
  if (candidates.length === 0) return null

  // 有多个候选时，尽量不重复上一题
  if (excludeWordId && candidates.length > 1) {
    const without = candidates.filter((w) => w.id !== excludeWordId)
    if (without.length > 0) candidates = without
  }

  // 均匀随机（Fisher–Yates 打乱后取第一个，等价于等概率）
  const word = shuffle(candidates)[0]

  const maps = (mapsByWordId.get(word.id) ?? [])
    .filter(isPracticePair)
    .slice(0, 5)

  // 音标选项去重，避免两个相同 /t/ 无法区分
  const seenPh = new Set<string>()
  const pairs: Array<{ grapheme: string; phoneme: string }> = []
  for (const m of maps) {
    if (seenPh.has(m.phoneme)) continue
    seenPh.add(m.phoneme)
    pairs.push({ grapheme: m.grapheme, phoneme: m.phoneme })
  }

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
