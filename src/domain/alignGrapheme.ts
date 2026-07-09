import { GRAPHEME_RULES, SINGLE_LETTER_MAP } from '../data/grapheme-rules'
import { splitPhonemes, stripIpaSlashes } from './phonemeSplit'

export interface AlignmentUnit {
  grapheme: string
  phoneme: string
  startIndex: number
  endIndex: number
  confidence: number
}

/**
 * 教学向字母组合-音标对齐：
 * 1. 从左到右贪心匹配最长 grapheme 规则
 * 2. 在剩余 phoneme 序列中找该规则允许的音标
 * 3. 否则单字母 + 启发式音标
 * 不追求语言学绝对精确。
 */
export function alignGraphemePhoneme(word: string, ipaFull: string): AlignmentUnit[] {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '')
  const phonemes = splitPhonemes(ipaFull)
  if (!letters || phonemes.length === 0) return []

  const units: AlignmentUnit[] = []
  let gi = 0
  let pi = 0

  const rulesByLen = [...GRAPHEME_RULES].sort((a, b) => b.grapheme.length - a.grapheme.length)

  while (gi < letters.length && pi < phonemes.length) {
    let matched = false

    for (const rule of rulesByLen) {
      const g = rule.grapheme
      if (!letters.startsWith(g, gi)) continue

      const found = findPhonemeMatch(phonemes, pi, rule.phonemes)
      if (found) {
        units.push({
          grapheme: g,
          phoneme: found.phoneme,
          startIndex: gi,
          endIndex: gi + g.length,
          confidence: found.exact ? 0.9 : 0.65,
        })
        gi += g.length
        pi = found.nextPi
        matched = true
        break
      }
    }

    if (matched) continue

    // 单字母
    const letter = letters[gi]
    const candidates = SINGLE_LETTER_MAP[letter] ?? []
    const found = findPhonemeMatch(phonemes, pi, candidates)
    if (found) {
      units.push({
        grapheme: letter,
        phoneme: found.phoneme,
        startIndex: gi,
        endIndex: gi + 1,
        confidence: found.exact ? 0.75 : 0.5,
      })
      gi += 1
      pi = found.nextPi
    } else {
      // 静音字母或对不齐：吃掉字母，弱置信度
      units.push({
        grapheme: letter,
        phoneme: '',
        startIndex: gi,
        endIndex: gi + 1,
        confidence: 0.3,
      })
      gi += 1
    }
  }

  // 剩余字母
  while (gi < letters.length) {
    units.push({
      grapheme: letters[gi],
      phoneme: '',
      startIndex: gi,
      endIndex: gi + 1,
      confidence: 0.25,
    })
    gi += 1
  }

  // 剩余音标并入最后有音标的单元
  if (pi < phonemes.length && units.length > 0) {
    const rest = phonemes.slice(pi).join('')
    const lastWithSound = [...units].reverse().find((u) => u.phoneme)
    if (lastWithSound) {
      lastWithSound.phoneme += rest
      lastWithSound.confidence = Math.min(lastWithSound.confidence, 0.55)
    }
  }

  return units.filter((u) => u.grapheme.length > 0)
}

function findPhonemeMatch(
  phonemes: string[],
  startPi: number,
  candidates: string[],
): { phoneme: string; nextPi: number; exact: boolean } | null {
  if (startPi >= phonemes.length) return null

  // 精确：从当前位置开始，候选是否等于 1 个或多个连续 phoneme 拼接
  for (const cand of candidates) {
    const candUnits = splitPhonemes(cand.startsWith('/') ? cand : `/${cand}/`)
    if (candUnits.length === 0) continue
    let ok = true
    for (let k = 0; k < candUnits.length; k++) {
      if (phonemes[startPi + k] !== candUnits[k]) {
        ok = false
        break
      }
    }
    if (ok) {
      return { phoneme: candUnits.join(''), nextPi: startPi + candUnits.length, exact: true }
    }
  }

  // 宽松：当前 phoneme 是否出现在候选列表中
  const current = phonemes[startPi]
  // 过滤装饰碎片，避免 ʰ 等被当成音素
  if (!current || /^[ʰʲʷˈˌ.]$/.test(current)) {
    return findPhonemeMatch(phonemes, startPi + 1, candidates)
  }

  for (const cand of candidates) {
    const stripped = stripIpaSlashes(cand)
    if (stripped === current || stripped.includes(current) || current.includes(stripped)) {
      return { phoneme: current, nextPi: startPi + 1, exact: stripped === current }
    }
  }

  // 无候选约束时消费一个 phoneme；有候选但都不匹配 → 不绑定（可能是静音字母）
  if (candidates.length === 0) {
    return { phoneme: current, nextPi: startPi + 1, exact: false }
  }

  return null
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
