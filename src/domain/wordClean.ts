import type { CandidateWord } from '../db/schema'

const TOKEN_RE = /[A-Za-z][A-Za-z'-]*[A-Za-z]|[A-Za-z]{2,}/g
const PURE_LETTER_RE = /^[A-Za-z]+$/

export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/['-]+/g, '')
}

export function isValidEnglishWord(raw: string): boolean {
  const cleaned = raw.trim()
  if (cleaned.length < 2) return false
  if (!PURE_LETTER_RE.test(cleaned.replace(/['-]/g, ''))) return false
  // 过滤过长噪音串
  if (cleaned.length > 24) return false
  return true
}

export function extractWordsFromText(
  text: string,
  confidences?: Map<string, number>,
): CandidateWord[] {
  const matches = text.match(TOKEN_RE) ?? []
  const seen = new Set<string>()
  const result: CandidateWord[] = []

  for (const match of matches) {
    if (!isValidEnglishWord(match)) continue
    const normalized = normalizeWord(match)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)

    const conf = confidences?.get(normalized) ?? confidences?.get(match.toLowerCase()) ?? 0.75
    result.push({
      word: match.toLowerCase(),
      normalized,
      confidence: conf,
      lowConfidence: conf < 0.55,
    })
  }

  return result
}

export function mergeCandidateLists(...lists: CandidateWord[][]): CandidateWord[] {
  const map = new Map<string, CandidateWord>()
  for (const list of lists) {
    for (const item of list) {
      const prev = map.get(item.normalized)
      if (!prev || item.confidence > prev.confidence) {
        map.set(item.normalized, item)
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.word.localeCompare(b.word))
}

export function parseManualWords(input: string): string[] {
  return extractWordsFromText(input.replace(/[,，、;；\n\t]+/g, ' ')).map((w) => w.word)
}
