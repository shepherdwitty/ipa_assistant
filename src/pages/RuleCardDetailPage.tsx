import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WordChip } from '../components/WordChip'
import { getRuleCard, listWordsForRule } from '../db/repos'
import type { RuleCard, WordRecord } from '../db/schema'
import { formatPhoneme } from '../domain/phonemeSplit'
import { speakPhoneme } from '../services/speech/speakPhoneme'

/** 首屏例词数量；词多时靠搜索 + 分页 */
const PREVIEW = 12
const STEP = 24

export function RuleCardDetailPage() {
  const { cardId: rawId } = useParams()
  const cardId = rawId ? decodeURIComponent(rawId) : ''
  const navigate = useNavigate()

  const [card, setCard] = useState<RuleCard | null>(null)
  const [words, setWords] = useState<WordRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PREVIEW)

  useEffect(() => {
    if (!cardId) {
      setError('规律卡片不存在')
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const c = await getRuleCard(cardId)
        if (!c) {
          setError('规律卡片不存在或已失效')
          setCard(null)
          setWords([])
          return
        }
        setCard(c)
        setWords(await listWordsForRule(c.grapheme, c.phoneme, c.exampleWordIds))
        // 进入页时自动听一遍音标，方便边讲边看
        void speakPhoneme(c.phoneme)
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [cardId])

  useEffect(() => {
    setQuery('')
    setLimit(PREVIEW)
  }, [cardId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return words
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        (w.ipaFull?.toLowerCase().includes(q) ?? false),
    )
  }, [words, query])

  const visible = filtered.slice(0, limit)
  const hiddenCount = Math.max(0, filtered.length - visible.length)

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">加载中…</p>
  }

  if (error || !card) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-red-600">{error || '规律卡片不存在'}</p>
        <Link to="/practice" className="text-brand-700 underline">
          返回练习
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/practice/cards')}
        className="text-sm font-medium text-brand-700"
      >
        ← 返回规律卡片
      </button>

      <header className="rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 px-5 py-7 text-center text-white shadow-sm">
        <p className="text-sm text-amber-100">规律卡片</p>
        <button
          type="button"
          className="mt-2 active:opacity-90"
          onClick={() => void speakPhoneme(card.phoneme)}
          aria-label={`朗读音标 ${formatPhoneme(card.phoneme)}`}
        >
          <div className="text-3xl font-bold tracking-wide">{card.grapheme}</div>
          <div className="my-1 text-amber-200">→</div>
          <div className="text-2xl font-semibold">{formatPhoneme(card.phoneme)}</div>
        </button>
        <p className="mt-3 text-xs text-amber-100/90">点音标可再听 · 关联 {words.length} 个词</p>
        <p className="mt-1 text-[11px] text-amber-100/70">
          教学向展示：该字母组合与音标在这些词里最相关，非绝对规律
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">例词</h2>
          <span className="text-xs text-slate-500">
            {query.trim()
              ? `匹配 ${filtered.length}`
              : words.length > visible.length
                ? `先看 ${visible.length} / ${words.length}`
                : `全部 ${words.length} 个`}
          </span>
        </div>

        {words.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            暂无关联单词（可能词条已删除）。可重新导入含该规律的词。
          </p>
        ) : (
          <>
            {words.length > PREVIEW ? (
              <label className="block">
                <span className="sr-only">搜索例词</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setLimit(PREVIEW)
                  }}
                  placeholder={`在 ${words.length} 个词里搜索…`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-brand-500 placeholder:text-slate-400 focus:ring-2"
                />
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {visible.map((w) => (
                <WordChip
                  key={w.id}
                  word={w.word}
                  sub={w.ipaFull}
                  highlight={card.grapheme}
                  onClick={() =>
                    navigate(
                      `/word/${w.id}?p=${encodeURIComponent(card.phoneme)}`,
                      {
                        state: {
                          backTo: `/practice/rules/${encodeURIComponent(card.id)}`,
                          backLabel: '返回规律卡片',
                        },
                      },
                    )
                  }
                />
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-500">没有匹配「{query}」的词</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + STEP)}
                  className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
                >
                  再显示 {Math.min(STEP, hiddenCount)} 个
                </button>
              ) : null}
              {hiddenCount > STEP ? (
                <button
                  type="button"
                  onClick={() => setLimit(filtered.length)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  全部展开
                </button>
              ) : null}
              {limit > PREVIEW && filtered.length > PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setLimit(PREVIEW)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  收起列表
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
