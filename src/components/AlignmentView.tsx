import { useEffect, useMemo, useState } from 'react'
import type { GraphemePhonemeMap } from '../db/schema'
import { formatPhoneme } from '../domain/phonemeSplit'
import { speakPhoneme, speakWord } from '../services/speech/speakPhoneme'

export function AlignmentView({
  word,
  ipaFull,
  maps,
  focusPhoneme,
}: {
  word: string
  ipaFull: string | null
  maps: GraphemePhonemeMap[]
  focusPhoneme?: string | null
}) {
  const sorted = useMemo(
    () => [...maps].sort((a, b) => a.startIndex - b.startIndex),
    [maps],
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!focusPhoneme || sorted.length === 0) return
    const target = focusPhoneme.replace(/^\/|\/$/g, '')
    if (!target) return
    const hit = sorted.find(
      (m) => m.phoneme === target || m.phoneme === focusPhoneme,
    )
    if (hit) setActiveId(hit.id)
  }, [focusPhoneme, sorted])

  const active = activeId ? sorted.find((m) => m.id === activeId) : null

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void speakWord(word)}
        className="w-full rounded-3xl bg-gradient-to-br from-brand-700 to-brand-800 px-5 py-6 text-center text-white shadow-lg transition active:scale-[0.99]"
        aria-label={`朗读单词 ${word}`}
      >
        <div className="text-3xl font-bold tracking-widest">{word}</div>
        <div className="mt-2 text-xl text-brand-100">{ipaFull ?? '音标待确认'}</div>
        <p className="mt-2 text-xs text-brand-100/80">点击读单词</p>
      </button>

      <p className="text-center text-xs text-slate-500">
        点击片段可高亮并听音标（字母与音标上下对齐）。
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {sorted.map((m) => {
          const isActive = activeId === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setActiveId((cur) => (cur === m.id ? null : m.id))
                if (m.phoneme) void speakPhoneme(m.phoneme)
              }}
              className={[
                'flex flex-col items-center rounded-2xl border-2 px-3 py-4 text-center transition',
                isActive
                  ? 'border-accent bg-accent-soft shadow-md'
                  : m.confidence < 0.55
                    ? 'border-dashed border-slate-200 bg-slate-50'
                    : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="text-xl font-bold text-slate-900">{m.grapheme}</div>
              <div className="my-1 text-slate-300">↓</div>
              <div className="text-lg font-semibold text-brand-700">
                {formatPhoneme(m.phoneme)}
              </div>
              {m.confidence < 0.55 ? (
                <div className="mt-1 text-[10px] text-slate-400">相关度较低</div>
              ) : null}
            </button>
          )
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          暂无音形拆解（音标未生成或待确认）
        </div>
      ) : null}

      {active ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          在这个单词里，最相关的字母组合是{' '}
          <strong className="text-brand-700">{active.grapheme}</strong>
          ，对应音标{' '}
          <strong className="text-brand-700">{formatPhoneme(active.phoneme)}</strong>
          。
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">点击上方某一片段查看说明并听发音</p>
      )}
    </div>
  )
}
