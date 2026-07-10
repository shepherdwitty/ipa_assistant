import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listRuleCards } from '../db/repos'
import type { RuleCard } from '../db/schema'
import { formatPhoneme } from '../domain/phonemeSplit'
import { speakPhoneme } from '../services/speech/speakPhoneme'

export function RuleCardsPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState<RuleCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        setCards(await listRuleCards())
      } catch (e) {
        console.error('加载规律卡片失败', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/practice')}
        className="text-sm font-medium text-brand-700"
      >
        ← 返回练习
      </button>
      <div>
        <h2 className="text-lg font-bold">规律卡片</h2>
        <p className="mt-1 text-sm text-slate-500">
          点卡片进入详情页，查看例词并跳转拆解讲解
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">加载中…</p>
      ) : cards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-sm text-slate-500">导入更多单词后会自动点亮规律卡片</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            去导入单词
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-4 text-center transition hover:border-amber-300 active:scale-[0.98]"
              onClick={() => {
                void speakPhoneme(c.phoneme)
                navigate(`/practice/rules/${encodeURIComponent(c.id)}`)
              }}
            >
              <div className="text-xl font-bold text-slate-900">{c.grapheme}</div>
              <div className="my-1 text-slate-300">→</div>
              <div className="text-lg font-semibold text-brand-700">
                {formatPhoneme(c.phoneme)}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                例词 {c.exampleWordIds.length || '·'} · 连对 {c.streakCorrect}
              </div>
              <div className="mt-1 text-[10px] font-medium text-amber-700/80">
                点击进入详情
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
