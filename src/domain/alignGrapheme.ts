import { GRAPHEME_RULES, SINGLE_LETTER_MAP } from '../data/grapheme-rules'
import { splitPhonemes, stripIpaSlashes } from './phonemeSplit'

export interface AlignmentUnit {
  grapheme: string
  phoneme: string
  startIndex: number
  endIndex: number
  confidence: number
}

/** 整词对齐质量 0~1；练习/规律卡只应使用高分段 */
export interface AlignmentResult {
  units: AlignmentUnit[]
  /** 0~1，越高越好 */
  quality: number
}

const INF = 1e9

interface Edge {
  nextGi: number
  nextPi: number
  grapheme: string
  phoneme: string
  /** 代价，越小越好 */
  cost: number
  confidence: number
}

/**
 * 教学向字母-音标对齐（动态规划，一劳永逸方向）：
 *
 * - 在 (字母下标 gi, 音标下标 pi) 网格上求最小代价路径
 * - 边：规则 digraph / 单字母 / 静音字母 / 强制 1 字母↔1 音标
 * - **禁止**「把剩余音标整块并入上一个单元」（历史 bug 根源）
 * - 未覆盖的音标以高代价强制挂到后续字母，而不是吞进前一片段
 *
 * 不追求语言学绝对精确，但保证：每个音标片段最多挂在一个 grapheme 上，
 * 且不会出现 t→/t(ə)ri/、pp→/pɔɪntiː/ 这类吞音。
 */
export function alignGraphemePhoneme(word: string, ipaFull: string): AlignmentUnit[] {
  return alignGraphemePhonemeDetailed(word, ipaFull).units
}

export function alignGraphemePhonemeDetailed(word: string, ipaFull: string): AlignmentResult {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '')
  const phonemes = splitPhonemes(ipaFull)
  if (!letters) return { units: [], quality: 0 }
  if (phonemes.length === 0) {
    const units = [...letters].map((ch, i) => ({
      grapheme: ch,
      phoneme: '',
      startIndex: i,
      endIndex: i + 1,
      confidence: 0.2,
    }))
    return { units, quality: 0.1 }
  }

  const n = letters.length
  const m = phonemes.length
  const moves = buildMoves(letters, phonemes)

  // dp[gi][pi] = min cost
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(INF))
  const choice: Array<Array<Edge | null>> = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(null),
  )
  dp[0][0] = 0

  for (let gi = 0; gi <= n; gi++) {
    for (let pi = 0; pi <= m; pi++) {
      if (dp[gi][pi] >= INF) continue
      const edges = moves(gi, pi)
      for (const e of edges) {
        const ng = e.nextGi
        const np = e.nextPi
        if (ng > n || np > m) continue
        const nc = dp[gi][pi] + e.cost
        if (nc < dp[ng][np]) {
          dp[ng][np] = nc
          choice[ng][np] = { ...e, /* store back ref via positions */ } as Edge & {
            fromGi?: number
            fromPi?: number
          }
          // 记录来源
          ;(choice[ng][np] as Edge & { fromGi: number; fromPi: number }).fromGi = gi
          ;(choice[ng][np] as Edge & { fromGi: number; fromPi: number }).fromPi = pi
        }
      }
    }
  }

  // 回溯
  if (dp[n][m] >= INF) {
    // 理论不应发生（有 force 边）；降级为空
    return { units: [], quality: 0 }
  }

  const rev: AlignmentUnit[] = []
  let gi = n
  let pi = m
  while (gi > 0 || pi > 0) {
    const e = choice[gi][pi] as (Edge & { fromGi: number; fromPi: number }) | null
    if (!e) break
    const fromGi = e.fromGi
    const fromPi = e.fromPi
    if (e.grapheme) {
      rev.push({
        grapheme: e.grapheme,
        phoneme: e.phoneme,
        startIndex: fromGi,
        endIndex: e.nextGi,
        confidence: e.confidence,
      })
    }
    gi = fromGi
    pi = fromPi
  }

  const units = rev.reverse()
  const quality = scoreQuality(units, dp[n][m], n, m)
  return { units, quality }
}

function buildMoves(letters: string, phonemes: string[]) {
  const n = letters.length
  const m = phonemes.length
  const rulesByLen = [...GRAPHEME_RULES].sort((a, b) => b.grapheme.length - a.grapheme.length)

  return (gi: number, pi: number): Edge[] => {
    const edges: Edge[] = []
    if (gi >= n && pi >= m) return edges

    // 1) 规则 digraph / multi grapheme（精确匹配候选音标）
    if (gi < n && pi < m) {
      for (const rule of rulesByLen) {
        const g = rule.grapheme
        if (!letters.startsWith(g, gi)) continue
        for (const cand of rule.phonemes) {
          const match = matchCandidate(phonemes, pi, cand)
          if (!match) continue
          // 越长越好：代价更低
          // 越长越好，但代价保持正数
          const lenBonus = Math.min(0.6, g.length * 0.12)
          edges.push({
            nextGi: gi + g.length,
            nextPi: match.nextPi,
            grapheme: g,
            phoneme: match.phoneme,
            cost: Math.max(0.25, (match.exact ? 1 : 2.2) - lenBonus),
            confidence: match.exact ? 0.9 : 0.65,
          })
        }
      }

      // 2) 单字母（在候选表内）
      const letter = letters[gi]
      const candidates = SINGLE_LETTER_MAP[letter] ?? []
      for (const cand of candidates) {
        const match = matchCandidate(phonemes, pi, cand)
        if (!match) continue
        edges.push({
          nextGi: gi + 1,
          nextPi: match.nextPi,
          grapheme: letter,
          phoneme: match.phoneme,
          cost: match.exact ? 1.1 : 2.5,
          confidence: match.exact ? 0.75 : 0.5,
        })
      }

      // 3) 强制：1 字母吃 1 音标（最后手段，禁止一次吃多个）
      edges.push({
        nextGi: gi + 1,
        nextPi: pi + 1,
        grapheme: letter,
        phoneme: phonemes[pi],
        cost: 5,
        confidence: 0.4,
      })
    }

    // 4) 静音字母（不消费音标）
    if (gi < n) {
      edges.push({
        nextGi: gi + 1,
        nextPi: pi,
        grapheme: letters[gi],
        phoneme: '',
        cost: 2.8,
        confidence: 0.3,
      })
    }

    // 5) 仅当还有音标但字母耗尽时：不再吞并，丢弃音标（极高代价）
    // 实际上 force 边应在字母未耗尽时已吃完；此边防止无解
    if (gi >= n && pi < m) {
      edges.push({
        nextGi: n,
        nextPi: pi + 1,
        grapheme: '',
        phoneme: phonemes[pi],
        cost: 12,
        confidence: 0.1,
      })
    }

    return edges
  }
}

function matchCandidate(
  phonemes: string[],
  startPi: number,
  cand: string,
): { phoneme: string; nextPi: number; exact: boolean } | null {
  if (startPi >= phonemes.length) return null
  const candUnits = splitPhonemes(cand.startsWith('/') ? cand : `/${cand}/`)
  if (candUnits.length === 0) return null

  // 精确：连续音标等于候选切分
  let ok = true
  for (let k = 0; k < candUnits.length; k++) {
    if (phonemes[startPi + k] !== candUnits[k]) {
      ok = false
      break
    }
  }
  if (ok) {
    return {
      phoneme: candUnits.join(''),
      nextPi: startPi + candUnits.length,
      exact: true,
    }
  }

  // 宽松：仅当候选为单段时，允许「当前音标与候选互相包含」
  // 不再用 includes 做多字符模糊（那会把 ɔɪ 误匹配到 ɔː 等）
  if (candUnits.length === 1) {
    const current = phonemes[startPi]
    const stripped = stripIpaSlashes(cand)
    if (!current) return null
    if (stripped === current) {
      return { phoneme: current, nextPi: startPi + 1, exact: true }
    }
    // 仅允许长音标记差异：i vs iː 由 split 已处理；此处允许 e/ɛ 已在 normalize
  }

  return null
}

function scoreQuality(units: AlignmentUnit[], totalCost: number, n: number, m: number): number {
  if (!units.length || m === 0) return 0

  const withSound = units.filter((u) => u.phoneme)
  // 单字母却挂多字符音标（长度>2 且含多个音素特征）→ 严重扣分
  let dumpPenalty = 0
  for (const u of withSound) {
    if (u.grapheme.length === 1 && u.phoneme.length > 2) dumpPenalty += 0.25
    if (/[()[\]|]/.test(u.phoneme)) dumpPenalty += 0.5
  }

  const avgConf =
    withSound.reduce((s, u) => s + u.confidence, 0) / Math.max(1, withSound.length)

  // 期望代价约 1.1 * max(n,m)；过高则质量低
  const expected = 1.2 * Math.max(n, m)
  const costScore = Math.max(0, 1 - (totalCost - expected) / (expected * 2 + 1))

  const coveredPh = withSound.map((u) => u.phoneme).join('').length
  const coverScore = Math.min(1, coveredPh / Math.max(1, m))

  const q = Math.max(0, Math.min(1, 0.45 * avgConf + 0.35 * costScore + 0.2 * coverScore - dumpPenalty))
  return Math.round(q * 100) / 100
}

/** 在对齐结果中找与目标音标最相关的 grapheme */
export function findGraphemeForPhoneme(
  units: AlignmentUnit[],
  targetPhoneme: string,
): AlignmentUnit | null {
  const target = stripIpaSlashes(targetPhoneme)
  const exact = units.find((u) => u.phoneme === target)
  if (exact) return exact
  return units.find((u) => u.phoneme.includes(target) || target.includes(u.phoneme)) ?? null
}

/** 单元是否达到「可教学展示」质量（练习/规律卡） */
export function isAlignmentUnitReliable(u: {
  grapheme: string
  phoneme: string
  confidence: number
}): boolean {
  if (!u.grapheme || !u.phoneme) return false
  if (u.confidence < 0.55) return false
  if (/[()[\]|]/.test(u.phoneme)) return false
  // 禁止单字母吞「多个音素单元」（t→t+ə+r+i）；单音素 iː/ɔɪ 的字符串长度可 >1
  if (u.grapheme.length === 1 && splitPhonemes(u.phoneme).length > 1) return false
  return true
}
