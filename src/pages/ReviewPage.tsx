import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WordChip } from '../components/WordChip'
import {
  confirmImport,
  getImport,
  updateImportCandidates,
} from '../db/repos'
import type { CandidateWord, ImportRecord } from '../db/schema'
import { isValidEnglishWord, normalizeWord } from '../domain/wordClean'

export function ReviewPage() {
  const { importId } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<ImportRecord | null>(null)
  const [candidates, setCandidates] = useState<CandidateWord[]>([])
  const [extra, setExtra] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!importId) return
    void getImport(importId).then((r) => {
      if (!r) {
        setError('导入记录不存在')
        return
      }
      setRecord(r)
      setCandidates(r.candidateWords)
    })
  }, [importId])

  const stats = useMemo(() => {
    const total = candidates.length
    const low = candidates.filter((c) => c.lowConfidence).length
    return { total, low, good: total - low }
  }, [candidates])

  function removeWord(normalized: string) {
    setCandidates((prev) => prev.filter((c) => c.normalized !== normalized))
  }

  function addWord() {
    const raw = extra.trim()
    if (!isValidEnglishWord(raw)) {
      setError('请输入有效英文单词（至少 2 个字母）')
      return
    }
    const normalized = normalizeWord(raw)
    if (candidates.some((c) => c.normalized === normalized)) {
      setError('该单词已在列表中')
      return
    }
    setCandidates((prev) => [
      ...prev,
      {
        word: raw.toLowerCase(),
        normalized,
        confidence: 1,
        lowConfidence: false,
      },
    ])
    setExtra('')
    setError('')
  }

  async function handleConfirm() {
    if (!importId || candidates.length === 0) {
      setError('请至少保留一个单词')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateImportCandidates(importId, candidates)
      await confirmImport(
        importId,
        candidates.map((c) => c.word),
      )
      navigate('/library', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!record && !error) {
    return <div className="py-12 text-center text-slate-500">加载中…</div>
  }

  if (error && !record) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/" className="text-brand-700 underline">
          返回导入
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">识别校对</h2>
        <p className="mt-1 text-sm text-slate-500">
          删除误识别，补录漏词，再确认生成音标库。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
          <div className="text-lg font-bold text-slate-800">{stats.total}</div>
          <div className="text-xs text-slate-500">识别到</div>
        </div>
        <div className="rounded-2xl bg-brand-50 px-3 py-3 text-center">
          <div className="text-lg font-bold text-brand-800">{stats.good}</div>
          <div className="text-xs text-brand-600">建议导入</div>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-3 text-center">
          <div className="text-lg font-bold text-amber-800">{stats.low}</div>
          <div className="text-xs text-amber-700">低置信度</div>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">候选单词</h3>
        {candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            暂无候选词，请手动补录
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <WordChip
                key={c.normalized}
                word={c.word}
                lowConfidence={c.lowConfidence}
                onRemove={() => removeWord(c.normalized)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <label className="text-sm font-semibold text-slate-700">补录单词</label>
        <div className="mt-2 flex gap-2">
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addWord()
              }
            }}
            placeholder="输入英文单词"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          />
          <button
            type="button"
            onClick={addWord}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white"
          >
            添加
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      <button
        type="button"
        disabled={submitting || candidates.length === 0}
        onClick={() => void handleConfirm()}
        className="w-full rounded-2xl bg-brand-700 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? '正在生成音标库…' : `确认导入 ${candidates.length} 个单词`}
      </button>

      <p className="text-center text-xs text-slate-400">
        确认后将生成英式 IPA，并建立音标反查索引
      </p>
    </div>
  )
}
