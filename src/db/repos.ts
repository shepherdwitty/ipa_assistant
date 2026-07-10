import { alignGraphemePhoneme, isAlignmentUnitReliable } from '../domain/alignGrapheme'
import { normalizeTeachingIpa } from '../domain/normalizeIpa'
import { splitPhonemes } from '../domain/phonemeSplit'
import { normalizeWord } from '../domain/wordClean'
import { ipaService } from '../services/ipa/ipaService'
import {
  createId,
  db,
  type CandidateWord,
  type GraphemePhonemeMap,
  type ImportRecord,
  type RuleCard,
  type SourceType,
  type WordPhoneme,
  type WordRecord,
} from './schema'

export async function createImportDraft(params: {
  sourceType: SourceType
  ocrRawText: string
  candidateWords: CandidateWord[]
}): Promise<ImportRecord> {
  const record: ImportRecord = {
    id: createId('imp'),
    sourceType: params.sourceType,
    ocrRawText: params.ocrRawText,
    candidateWords: params.candidateWords,
    confirmedWords: [],
    status: 'review',
    createdAt: Date.now(),
  }
  await db.imports.add(record)
  return record
}

export async function createManualImport(words: string[]): Promise<ImportRecord> {
  const candidates: CandidateWord[] = words.map((w) => ({
    word: w.toLowerCase(),
    normalized: normalizeWord(w),
    confidence: 1,
    lowConfidence: false,
  }))
  return createImportDraft({
    sourceType: 'manual',
    ocrRawText: words.join(' '),
    candidateWords: candidates,
  })
}

export async function getImport(id: string): Promise<ImportRecord | undefined> {
  return db.imports.get(id)
}

export async function updateImportCandidates(
  id: string,
  candidateWords: CandidateWord[],
): Promise<void> {
  await db.imports.update(id, { candidateWords })
}

export async function confirmImport(
  importId: string,
  confirmedWords: string[],
): Promise<WordRecord[]> {
  const unique = Array.from(
    new Map(confirmedWords.map((w) => [normalizeWord(w), w.toLowerCase()])).entries(),
  )

  // IPA 网络查询放在事务外，避免事务超时
  const prepared: Array<{
    normalized: string
    word: string
    existing?: WordRecord
    ipa?: Awaited<ReturnType<typeof ipaService.lookup>>
  }> = []

  for (const [normalized, word] of unique) {
    const existing = await db.words.where('normalizedWord').equals(normalized).first()
    if (existing) {
      // 已有词若仍是待确认，尝试重新查音标并补全索引
      if (existing.status === 'pending' || !existing.ipaFull) {
        await refreshWordIpa(existing.id)
        const updated = await db.words.get(existing.id)
        prepared.push({ normalized, word, existing: updated ?? existing })
      } else {
        prepared.push({ normalized, word, existing })
        const maps = await getGraphemeMaps(existing.id)
        if (maps.length) await upsertRuleCardsFromMaps(maps, existing.id)
      }
      continue
    }
    const ipa = await ipaService.lookup(word)
    prepared.push({ normalized, word, ipa })
  }

  const created: WordRecord[] = []

  await db.transaction(
    'rw',
    db.imports,
    db.words,
    db.wordPhonemes,
    db.graphemeMaps,
    db.ruleCards,
    async () => {
      for (const item of prepared) {
        if (item.existing) {
          created.push(item.existing)
          continue
        }

        const ipa = item.ipa!
        const hasIpa = Boolean(ipa.ipa)
        const normalizedIpa = hasIpa && ipa.ipa ? normalizeTeachingIpa(ipa.ipa) : null
        const wordRec: WordRecord = {
          id: createId('w'),
          word: item.word,
          normalizedWord: item.normalized,
          ipaFull: normalizedIpa,
          syllables: ipa.syllables,
          sourceImportId: importId,
          status: hasIpa ? 'normal' : 'pending',
          createdAt: Date.now(),
        }
        await db.words.add(wordRec)
        created.push(wordRec)

        if (normalizedIpa) {
          const phonemes = splitPhonemes(normalizedIpa)
          const phonemeRows: WordPhoneme[] = phonemes.map((p, idx) => ({
            id: createId('ph'),
            wordId: wordRec.id,
            phoneme: p,
            positionInWord: idx,
            positionInIpa: idx,
          }))
          await db.wordPhonemes.bulkAdd(phonemeRows)

          const alignments = alignGraphemePhoneme(item.word, normalizedIpa)
          const mapRows: GraphemePhonemeMap[] = alignments
            .filter((a) => a.phoneme)
            .map((a) => ({
              id: createId('gp'),
              wordId: wordRec.id,
              grapheme: a.grapheme,
              phoneme: a.phoneme,
              startIndex: a.startIndex,
              endIndex: a.endIndex,
              confidence: a.confidence,
            }))
          if (mapRows.length) await db.graphemeMaps.bulkAdd(mapRows)

          await upsertRuleCardsFromMaps(mapRows, wordRec.id)
        }
      }

      await db.imports.update(importId, {
        confirmedWords: unique.map(([, w]) => w),
        status: 'confirmed',
      })
    },
  )

  // 事务外再全量回填一次，确保规律卡片与拆解一致
  await rebuildRuleCardsFromLibrary()

  return created
}

/** 多字母组合 + 可靠对齐 → 规律卡片（如 ph→/f/） */
function isRuleCardWorthy(m: Pick<GraphemePhonemeMap, 'grapheme' | 'phoneme' | 'confidence'>): boolean {
  if (m.grapheme.length < 2) return false
  return isAlignmentUnitReliable(m)
}

async function upsertRuleCardsFromMaps(
  maps: GraphemePhonemeMap[],
  wordId: string,
): Promise<void> {
  for (const m of maps) {
    if (!isRuleCardWorthy(m)) continue
    const id = `rule_${m.grapheme}_${m.phoneme}`
    const existing = await db.ruleCards.get(id)
    if (existing) {
      const examples = Array.from(new Set([...existing.exampleWordIds, wordId]))
      await db.ruleCards.update(id, {
        exampleWordIds: examples,
        unlocked: true,
        updatedAt: Date.now(),
      })
    } else {
      const card: RuleCard = {
        id,
        grapheme: m.grapheme,
        phoneme: m.phoneme,
        unlocked: true,
        streakCorrect: 0,
        exampleWordIds: [wordId],
        updatedAt: Date.now(),
      }
      await db.ruleCards.add(card)
    }
  }
}

/**
 * 用已存 IPA 重新归一化并重建音素切分 / 音形对齐（不重新请求 API）。
 * 用于算法升级后修复本地旧数据，例如 oɪ→ɔɪ 导致 appointee 字母与音标错位。
 */
export async function realignAllWordsFromStoredIpa(): Promise<number> {
  const words = await db.words.filter((w) => Boolean(w.ipaFull)).toArray()
  let updated = 0

  for (const word of words) {
    if (!word.ipaFull) continue
    const ipa = normalizeTeachingIpa(word.ipaFull)
    const phonemes = splitPhonemes(ipa)
    const alignments = alignGraphemePhoneme(word.word, ipa)

    await db.wordPhonemes.where('wordId').equals(word.id).delete()
    await db.graphemeMaps.where('wordId').equals(word.id).delete()

    if (phonemes.length) {
      await db.wordPhonemes.bulkAdd(
        phonemes.map((p, idx) => ({
          id: createId('ph'),
          wordId: word.id,
          phoneme: p,
          positionInWord: idx,
          positionInIpa: idx,
        })),
      )
    }

    const mapRows: GraphemePhonemeMap[] = alignments
      .filter((a) => a.phoneme)
      .map((a) => ({
        id: createId('gp'),
        wordId: word.id,
        grapheme: a.grapheme,
        phoneme: a.phoneme,
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        confidence: a.confidence,
      }))
    if (mapRows.length) await db.graphemeMaps.bulkAdd(mapRows)

    if (word.ipaFull !== ipa) {
      await db.words.update(word.id, { ipaFull: ipa })
    }
    updated += 1
  }

  // 卡片依赖 graphemeMaps，需全量重建以免残留错误规则
  await db.ruleCards.clear()
  await rebuildRuleCardsFromLibrary()
  return updated
}

/** 本地对齐算法版本；升级后触发一次 realignAllWordsFromStoredIpa */
export const ALIGNMENT_DATA_VERSION = 6

const ALIGNMENT_VERSION_KEY = 'ipa-kids-alignment-version'

/** App 启动时调用：若算法版本变更则重对齐本地词库 */
export async function migrateAlignmentIfNeeded(): Promise<void> {
  try {
    const current = Number(localStorage.getItem(ALIGNMENT_VERSION_KEY) || '0')
    if (current >= ALIGNMENT_DATA_VERSION) return
    await realignAllWordsFromStoredIpa()
    localStorage.setItem(ALIGNMENT_VERSION_KEY, String(ALIGNMENT_DATA_VERSION))
  } catch {
    // 迁移失败不阻塞 UI；下次启动会重试
  }
}

/**
 * 从现有词库的音形映射回填规律卡片。
 * 解决：旧数据导入时未写卡片 / 重复导入跳过新词路径 导致「有 ph→/f/ 拆解但卡片为 0」。
 */
export async function rebuildRuleCardsFromLibrary(): Promise<number> {
  const allMaps = await db.graphemeMaps.toArray()
  // 按 wordId 分组处理
  const byWord = new Map<string, GraphemePhonemeMap[]>()
  for (const m of allMaps) {
    const list = byWord.get(m.wordId) ?? []
    list.push(m)
    byWord.set(m.wordId, list)
  }

  for (const [wordId, maps] of byWord) {
    await upsertRuleCardsFromMaps(maps, wordId)
  }

  return db.ruleCards.count()
}

export async function listWords(): Promise<WordRecord[]> {
  return db.words.orderBy('createdAt').reverse().toArray()
}

export async function getWord(id: string): Promise<WordRecord | undefined> {
  return db.words.get(id)
}

/**
 * 重新查询音标并重建 phoneme / 音形映射 / 规律卡。
 * 用于「待确认」词在词表/API 增强后的补救。
 */
export async function refreshWordIpa(wordId: string): Promise<WordRecord | null> {
  const word = await db.words.get(wordId)
  if (!word) return null

  const ipa = await ipaService.lookup(word.word)
  const hasIpa = Boolean(ipa.ipa)

  // 清掉旧索引
  await db.wordPhonemes.where('wordId').equals(wordId).delete()
  await db.graphemeMaps.where('wordId').equals(wordId).delete()

  if (!hasIpa || !ipa.ipa) {
    await db.words.update(wordId, {
      ipaFull: null,
      syllables: null,
      status: 'pending',
    })
    return (await db.words.get(wordId)) ?? null
  }

  // 再走一遍教学归一化，防止上游偶发未归一化（如 oɪ vs ɔɪ）
  const normalizedIpa = normalizeTeachingIpa(ipa.ipa)
  const phonemes = splitPhonemes(normalizedIpa)
  await db.wordPhonemes.bulkAdd(
    phonemes.map((p, idx) => ({
      id: createId('ph'),
      wordId,
      phoneme: p,
      positionInWord: idx,
      positionInIpa: idx,
    })),
  )

  const alignments = alignGraphemePhoneme(word.word, normalizedIpa)
  const mapRows: GraphemePhonemeMap[] = alignments
    .filter((a) => a.phoneme)
    .map((a) => ({
      id: createId('gp'),
      wordId,
      grapheme: a.grapheme,
      phoneme: a.phoneme,
      startIndex: a.startIndex,
      endIndex: a.endIndex,
      confidence: a.confidence,
    }))
  if (mapRows.length) await db.graphemeMaps.bulkAdd(mapRows)
  await upsertRuleCardsFromMaps(mapRows, wordId)

  await db.words.update(wordId, {
    ipaFull: normalizedIpa,
    syllables: ipa.syllables,
    status: 'normal',
  })

  await rebuildRuleCardsFromLibrary()
  return (await db.words.get(wordId)) ?? null
}

/** 批量刷新所有待确认词 */
export async function refreshAllPendingWords(): Promise<number> {
  const pending = await db.words.filter((w) => w.status === 'pending' || !w.ipaFull).toArray()
  let ok = 0
  for (const w of pending) {
    const updated = await refreshWordIpa(w.id)
    if (updated?.status === 'normal') ok += 1
  }
  return ok
}

export async function getGraphemeMaps(wordId: string): Promise<GraphemePhonemeMap[]> {
  return db.graphemeMaps.where('wordId').equals(wordId).toArray()
}

export async function getWordPhonemes(wordId: string): Promise<WordPhoneme[]> {
  return db.wordPhonemes.where('wordId').equals(wordId).toArray()
}

export async function findWordsByPhoneme(phoneme: string): Promise<
  Array<{
    word: WordRecord
    maps: GraphemePhonemeMap[]
    matchedGrapheme: string | null
  }>
> {
  const rows = await db.wordPhonemes.where('phoneme').equals(phoneme).toArray()
  const wordIds = Array.from(new Set(rows.map((r) => r.wordId)))
  const results: Array<{
    word: WordRecord
    maps: GraphemePhonemeMap[]
    matchedGrapheme: string | null
  }> = []

  for (const wid of wordIds) {
    const word = await db.words.get(wid)
    if (!word || word.status === 'ignored') continue
    const maps = await getGraphemeMaps(wid)
    const match = maps.find((m) => m.phoneme === phoneme || m.phoneme.includes(phoneme))
    results.push({
      word,
      maps,
      matchedGrapheme: match?.grapheme ?? null,
    })
  }

  return results.sort((a, b) => a.word.word.localeCompare(b.word.word))
}

export async function listUsedPhonemes(): Promise<string[]> {
  const all = await db.wordPhonemes.toArray()
  // 过滤切分噪声（如单独的括号、空串）
  const valid = all
    .map((p) => p.phoneme)
    .filter((p) => p && p.length > 0 && !/^[()[\]\/.\s]+$/.test(p))
  return Array.from(new Set(valid)).sort()
}

export async function listRuleCards(): Promise<RuleCard[]> {
  // 每次读取前轻量回填，保证拆解页已有 ph→/f/ 时卡片能亮
  await rebuildRuleCardsFromLibrary()
  // 注意：updatedAt 未建 Dexie 索引，不能 orderBy('updatedAt')，否则会抛错导致 UI 一直显示 0
  const cards = await db.ruleCards.toArray()
  return cards.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function getRuleCard(id: string): Promise<RuleCard | undefined> {
  await rebuildRuleCardsFromLibrary()
  return db.ruleCards.get(id)
}

/**
 * 某条规律（字母组合 → 音标）关联的全部正常单词。
 * 合并卡片例词 id 与 graphemeMaps 反查结果。
 */
export async function listWordsForRule(
  grapheme: string,
  phoneme: string,
  exampleWordIds: string[] = [],
): Promise<WordRecord[]> {
  const maps = await db.graphemeMaps
    .where('grapheme')
    .equals(grapheme)
    .filter((m) => m.phoneme === phoneme)
    .toArray()

  const idSet = new Set<string>([...exampleWordIds, ...maps.map((m) => m.wordId)])
  if (idSet.size === 0) return []

  const rows = await db.words.bulkGet([...idSet])
  return rows
    .filter((w): w is WordRecord => Boolean(w && w.status === 'normal' && w.ipaFull))
    .sort((a, b) => {
      // 短词优先，便于讲解
      const len = a.word.length - b.word.length
      if (len !== 0) return len
      return a.word.localeCompare(b.word)
    })
}

export async function bumpRuleStreak(grapheme: string, phoneme: string, correct: boolean) {
  const id = `rule_${grapheme}_${phoneme}`
  const card = await db.ruleCards.get(id)
  if (!card) return
  await db.ruleCards.update(id, {
    streakCorrect: correct ? card.streakCorrect + 1 : 0,
    updatedAt: Date.now(),
  })
}

export async function countStats() {
  await rebuildRuleCardsFromLibrary()
  const [wordCount, phonemeRows, ruleCount] = await Promise.all([
    db.words.count(),
    db.wordPhonemes.toArray(),
    db.ruleCards.filter((c) => c.unlocked).count(),
  ])
  const phonemeCount = new Set(phonemeRows.map((p) => p.phoneme)).size
  return { wordCount, phonemeCount, ruleCount }
}

/** 删除单个单词及其音标索引、音形映射，并清理规律卡例词 */
export async function deleteWord(wordId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.words,
    db.wordPhonemes,
    db.graphemeMaps,
    db.ruleCards,
    async () => {
      await db.words.delete(wordId)
      await db.wordPhonemes.where('wordId').equals(wordId).delete()
      await db.graphemeMaps.where('wordId').equals(wordId).delete()

      const cards = await db.ruleCards.toArray()
      for (const c of cards) {
        if (!c.exampleWordIds.includes(wordId)) continue
        const examples = c.exampleWordIds.filter((id) => id !== wordId)
        if (examples.length === 0) {
          await db.ruleCards.delete(c.id)
        } else {
          await db.ruleCards.update(c.id, {
            exampleWordIds: examples,
            updatedAt: Date.now(),
          })
        }
      }
    },
  )
}

export async function clearAllData() {
  await Promise.all([
    db.imports.clear(),
    db.words.clear(),
    db.wordPhonemes.clear(),
    db.graphemeMaps.clear(),
    db.ruleCards.clear(),
    db.practiceMistakes.clear(),
  ])
}
