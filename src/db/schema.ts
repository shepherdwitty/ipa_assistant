import Dexie, { type EntityTable } from 'dexie'

export type SourceType = 'camera' | 'gallery' | 'screenshot' | 'manual'
export type ImportStatus = 'processing' | 'review' | 'confirmed' | 'failed'
export type WordStatus = 'normal' | 'pending' | 'ignored'

export interface CandidateWord {
  word: string
  normalized: string
  confidence: number
  lowConfidence: boolean
}

export interface ImportRecord {
  id: string
  sourceType: SourceType
  ocrRawText: string
  candidateWords: CandidateWord[]
  confirmedWords: string[]
  status: ImportStatus
  createdAt: number
}

export interface WordRecord {
  id: string
  word: string
  normalizedWord: string
  ipaFull: string | null
  syllables: string | null
  sourceImportId: string | null
  status: WordStatus
  createdAt: number
}

export interface WordPhoneme {
  id: string
  wordId: string
  phoneme: string
  positionInWord: number
  positionInIpa: number
}

export interface GraphemePhonemeMap {
  id: string
  wordId: string
  grapheme: string
  phoneme: string
  startIndex: number
  endIndex: number
  confidence: number
}

export interface RuleCard {
  id: string
  grapheme: string
  phoneme: string
  unlocked: boolean
  streakCorrect: number
  exampleWordIds: string[]
  updatedAt: number
}

export interface PracticeMistake {
  id: string
  type: 'phoneme-find' | 'pair-match'
  prompt: string
  correctAnswer: string
  userAnswer: string
  createdAt: number
}

class IpaDatabase extends Dexie {
  imports!: EntityTable<ImportRecord, 'id'>
  words!: EntityTable<WordRecord, 'id'>
  wordPhonemes!: EntityTable<WordPhoneme, 'id'>
  graphemeMaps!: EntityTable<GraphemePhonemeMap, 'id'>
  ruleCards!: EntityTable<RuleCard, 'id'>
  practiceMistakes!: EntityTable<PracticeMistake, 'id'>

  constructor() {
    super('ipa-kids-db')
    this.version(1).stores({
      imports: 'id, createdAt, status',
      words: 'id, normalizedWord, status, createdAt, sourceImportId',
      wordPhonemes: 'id, wordId, phoneme',
      graphemeMaps: 'id, wordId, grapheme, phoneme',
      ruleCards: 'id, grapheme, phoneme, unlocked',
      practiceMistakes: 'id, createdAt, type',
    })
  }
}

export const db = new IpaDatabase()

export function createId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID()}`
}
