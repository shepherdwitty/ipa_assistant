import { CHINA_48_PHONEMES } from '../data/phoneme-audio-map'
import type { GraphemePhonemeMap, WordRecord } from '../db/schema'
import { isAlignmentUnitReliable } from './alignGrapheme'

export type PracticeKind = 'phoneme-find' | 'pair-match' | 'listen-choose'

/** 听音选音标：一次完整测试题量 */
export const LISTEN_CHOOSE_SESSION_SIZE = 30

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

export interface ListenChooseQuestion {
  kind: 'listen-choose'
  /** 正确答案音标 */
  answer: string
  /** 4 个选项（含正确答案，已乱序） */
  options: string[]
}

export type PracticeQuestion =
  | PhonemeFindQuestion
  | PairMatchQuestion
  | ListenChooseQuestion

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- 听音选音标：相近干扰项 ----------

/**
 * 教学向易混簇：同簇内互为干扰项（长短元音、清浊对立、破擦相近等）。
 * 一个音标可属于多簇，生成时会合并。
 */
const CONFUSABLE_CLUSTERS: readonly (readonly string[])[] = [
  // 前元音 / 相关双元音
  ['iː', 'ɪ', 'e', 'eɪ'],
  ['e', 'æ', 'eɪ', 'eə'],
  ['æ', 'e', 'ʌ', 'ɑː'],
  // 后/中元音
  ['ɑː', 'ʌ', 'ɒ', 'ɔː'],
  ['ɒ', 'ɔː', 'əʊ', 'ɑː'],
  ['ʊ', 'uː', 'əʊ', 'ɔː'],
  ['uː', 'ʊ', 'əʊ', 'ɔː'],
  ['ʌ', 'ə', 'ɜː', 'ɑː'],
  ['ɜː', 'ə', 'e', 'ʌ'],
  ['ə', 'ɜː', 'ʌ', 'ʊ'],
  // 双元音
  ['eɪ', 'aɪ', 'ɔɪ', 'e'],
  ['aɪ', 'aʊ', 'eɪ', 'ɔɪ'],
  ['ɔɪ', 'ɔː', 'aɪ', 'əʊ'],
  ['əʊ', 'aʊ', 'ɔː', 'ʊ'],
  ['aʊ', 'aɪ', 'əʊ', 'ɑː'],
  ['ɪə', 'eə', 'ʊə', 'ɪ'],
  ['eə', 'ɪə', 'eɪ', 'e'],
  ['ʊə', 'ʊ', 'uː', 'ə'],
  // 爆破
  ['p', 'b', 't', 'd'],
  ['t', 'd', 'k', 'ɡ'],
  ['k', 'ɡ', 't', 'd'],
  // 摩擦
  ['f', 'v', 'θ', 'ð'],
  ['θ', 'ð', 's', 'z'],
  ['s', 'z', 'ʃ', 'ʒ'],
  ['ʃ', 'ʒ', 'tʃ', 'dʒ'],
  ['h', 'f', 'θ', 's'],
  // 破擦 / 教材扩展
  ['tʃ', 'dʒ', 'tr', 'dr'],
  ['ts', 'dz', 'tʃ', 'dʒ'],
  ['tr', 'dr', 'tʃ', 'dʒ'],
  // 鼻音 / 边音 / 半元音
  ['m', 'n', 'ŋ', 'l'],
  ['n', 'ŋ', 'm', 'l'],
  ['l', 'r', 'n', 'w'],
  ['r', 'l', 'w', 'j'],
  ['j', 'w', 'r', 'iː'],
  ['w', 'v', 'r', 'ʊ'],
]

const MONOPHTHONGS = new Set(CHINA_48_PHONEMES.slice(0, 12))
const DIPHTHONGS = new Set(CHINA_48_PHONEMES.slice(12, 20))

function phonemeCategory(p: string): 'mono' | 'dip' | 'con' {
  if (MONOPHTHONGS.has(p)) return 'mono'
  if (DIPHTHONGS.has(p)) return 'dip'
  return 'con'
}

/** 每个音标 → 易混干扰候选（不含自身） */
function buildConfusableMap(): Map<string, string[]> {
  const map = new Map<string, Set<string>>()
  for (const p of CHINA_48_PHONEMES) map.set(p, new Set())
  for (const cluster of CONFUSABLE_CLUSTERS) {
    for (const p of cluster) {
      if (!map.has(p)) continue
      for (const q of cluster) {
        if (q !== p && map.has(q)) map.get(p)!.add(q)
      }
    }
  }
  return new Map([...map.entries()].map(([k, v]) => [k, [...v]]))
}

const CONFUSABLE_MAP = buildConfusableMap()

/**
 * 为正确答案挑选 3 个干扰项：优先易混簇，其次同大类，最后全库补齐。
 */
export function pickListenChooseDistractors(
  answer: string,
  count = 3,
): string[] {
  const pool = new Set<string>()
  const confusable = CONFUSABLE_MAP.get(answer) ?? []
  for (const p of shuffle(confusable)) {
    if (p === answer) continue
    pool.add(p)
    if (pool.size >= count) break
  }

  if (pool.size < count) {
    const cat = phonemeCategory(answer)
    const sameCat = CHINA_48_PHONEMES.filter(
      (p) => p !== answer && phonemeCategory(p) === cat && !pool.has(p),
    )
    for (const p of shuffle(sameCat)) {
      pool.add(p)
      if (pool.size >= count) break
    }
  }

  if (pool.size < count) {
    const rest = CHINA_48_PHONEMES.filter((p) => p !== answer && !pool.has(p))
    for (const p of shuffle(rest)) {
      pool.add(p)
      if (pool.size >= count) break
    }
  }

  return [...pool].slice(0, count)
}

/** 生成单道听音选音标题 */
export function generateListenChoose(answer?: string): ListenChooseQuestion {
  const ans =
    answer && CHINA_48_PHONEMES.includes(answer as (typeof CHINA_48_PHONEMES)[number])
      ? answer
      : shuffle([...CHINA_48_PHONEMES])[0]
  const distractors = pickListenChooseDistractors(ans, 3)
  return {
    kind: 'listen-choose',
    answer: ans,
    options: shuffle([ans, ...distractors]),
  }
}

/**
 * 生成一整轮测试（默认 30 题）。
 * 正确答案在 48 音标中无放回抽样，避免一轮内重复听同一音。
 */
export function generateListenChooseSession(
  size = LISTEN_CHOOSE_SESSION_SIZE,
): ListenChooseQuestion[] {
  const n = Math.min(Math.max(1, size), CHINA_48_PHONEMES.length)
  const answers = shuffle([...CHINA_48_PHONEMES]).slice(0, n)
  return answers.map((a) => generateListenChoose(a))
}

export function checkListenChoose(
  q: ListenChooseQuestion,
  selected: string | null | undefined,
): boolean {
  return selected === q.answer
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
