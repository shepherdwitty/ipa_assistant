import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmModal } from '../components/ConfirmModal'
import { PhonemeCard } from '../components/PhonemeCard'
import { WordChip } from '../components/WordChip'
import { speakPhoneme } from '../services/speech/speakPhoneme'
import { COMMON_PHONEMES } from '../data/common-phonemes'
import {
  clearAllData,
  findWordsByPhoneme,
  listUsedPhonemes,
  listWords,
} from '../db/repos'
import type { WordRecord } from '../db/schema'
import { formatPhoneme, normalizePhonemeQuery } from '../domain/phonemeSplit'
import {
  getAppScrollRoot,
  loadLibraryUi,
  readScrollTop,
  saveLibraryUi,
  writeScrollTop,
  type LibraryTab,
} from './libraryUiState'

export function LibraryPage() {
  const navigate = useNavigate()
  const initial = loadLibraryUi()
  const [tab, setTab] = useState<LibraryTab>(initial.tab)
  const [words, setWords] = useState<WordRecord[]>([])
  const [usedPhonemes, setUsedPhonemes] = useState<string[]>([])
  const [query, setQuery] = useState(initial.query)
  const [activePhoneme, setActivePhoneme] = useState<string | null>(initial.activePhoneme)
  const [results, setResults] = useState<
    Array<{ word: WordRecord; matchedGrapheme: string | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function refresh() {
    setLoading(true)
    const [w, p] = await Promise.all([listWords(), listUsedPhonemes()])
    setWords(w)
    setUsedPhonemes(p)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  // 持久化 Tab / 搜索 / 选中音标
  useEffect(() => {
    saveLibraryUi({ tab, query, activePhoneme })
  }, [tab, query, activePhoneme])

  // 滚动监听：按 Tab 分别记住高度；离开页面时再写一次
  useEffect(() => {
    const main = getAppScrollRoot()
    if (!main) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        saveLibraryUi({ scrollByTab: { [tab]: main.scrollTop } })
        ticking = false
      })
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      saveLibraryUi({
        tab,
        query,
        activePhoneme,
        scrollByTab: { [tab]: main.scrollTop },
      })
      main.removeEventListener('scroll', onScroll)
    }
  }, [tab, query, activePhoneme])

  // 进入页 / 数据就绪后恢复滚动（例词列表晚到时再补一次）
  const pendingScrollRestore = useRef(true)
  useEffect(() => {
    if (loading || !pendingScrollRestore.current) return
    const top = loadLibraryUi().scrollByTab[tab] ?? 0
    const apply = () => writeScrollTop(top)
    requestAnimationFrame(() => {
      requestAnimationFrame(apply)
    })
    const t = window.setTimeout(() => {
      apply()
      pendingScrollRestore.current = false
    }, 120)
    return () => window.clearTimeout(t)
  }, [loading, tab, results.length])

  useEffect(() => {
    if (!activePhoneme) {
      setResults([])
      return
    }
    void findWordsByPhoneme(activePhoneme).then((rows) =>
      setResults(rows.map((r) => ({ word: r.word, matchedGrapheme: r.matchedGrapheme }))),
    )
  }, [activePhoneme])

  const phonemeCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of usedPhonemes) map.set(p, (map.get(p) ?? 0) + 1)
    return map
  }, [usedPhonemes])

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return words
    return words.filter(
      (w) =>
        w.word.includes(q) ||
        w.ipaFull?.includes(q) ||
        w.normalizedWord.includes(q),
    )
  }, [words, query])

  function switchTab(next: LibraryTab) {
    if (next === tab) return
    // 离开当前 Tab 前记下滚动
    saveLibraryUi({
      tab: next,
      scrollByTab: { [tab]: readScrollTop() },
    })
    setTab(next)
    // 切到目标 Tab 的历史滚动
    const top = loadLibraryUi().scrollByTab[next] ?? 0
    requestAnimationFrame(() => {
      writeScrollTop(top)
    })
  }

  function handleSearchPhoneme() {
    const p = normalizePhonemeQuery(query)
    if (!p) return
    switchTab('phonemes')
    setActivePhoneme(p)
  }

  async function confirmClear() {
    setClearing(true)
    try {
      await clearAllData()
      setActivePhoneme(null)
      setShowClearModal(false)
      await refresh()
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-500">加载词库…</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">词库 / 音标库</h2>
          <p className="mt-1 text-sm text-slate-500">
            已导入 {words.length} 个单词 · {usedPhonemes.length} 种音标
          </p>
        </div>
        <Link
          to="/"
          className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700"
        >
          + 导入
        </Link>
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
        {(
          [
            ['phonemes', '音标'],
            ['words', '单词'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={[
              'flex-1 rounded-xl py-2 text-sm font-medium transition',
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tab === 'phonemes') handleSearchPhoneme()
          }}
          placeholder={tab === 'phonemes' ? '搜索音标，如 f 或 /ʃ/' : '搜索单词'}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
        />
        {tab === 'phonemes' ? (
          <button
            type="button"
            onClick={handleSearchPhoneme}
            className="rounded-2xl bg-slate-800 px-4 text-sm font-medium text-white"
          >
            查
          </button>
        ) : null}
      </div>

      {words.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-12 text-center">
          <p className="text-slate-600">词库还是空的</p>
          <p className="mt-1 text-sm text-slate-400">先去导入图片或手动补录单词吧</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            去导入
          </Link>
        </div>
      ) : tab === 'words' ? (
        <div className="flex flex-wrap gap-2">
          {filteredWords.map((w) => (
            <WordChip
              key={w.id}
              word={w.word}
              sub={w.ipaFull ?? '待确认'}
              onClick={() => navigate(`/word/${w.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              48 个国际音标（英式教学）
            </h3>
            {(
              [
                '长元音',
                '短元音',
                '双元音',
                '清辅音',
                '浊辅音',
              ] as const
            ).map((group) => {
              const items = COMMON_PHONEMES.filter((p) => p.group === group)
              if (!items.length) return null
              return (
                <div key={group} className="mb-3">
                  <h4 className="mb-1.5 text-xs font-medium text-slate-500">{group}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((p) => (
                      <PhonemeCard
                        key={p.phoneme}
                        phoneme={p.phoneme}
                        label={p.label}
                        tip={p.tip}
                        active={activePhoneme === p.phoneme}
                        count={phonemeCounts.has(p.phoneme) ? undefined : undefined}
                        onClick={() =>
                          setActivePhoneme((cur) =>
                            cur === p.phoneme ? null : p.phoneme,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {usedPhonemes.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">词库中出现的音标</h3>
              <div className="flex flex-wrap gap-2">
                {usedPhonemes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      void speakPhoneme(p)
                      setActivePhoneme(p)
                    }}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-[0.98]',
                      activePhoneme === p
                        ? 'border-brand-500 bg-brand-50 text-brand-800'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                  >
                    {formatPhoneme(p)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePhoneme ? (
            <div className="rounded-3xl border border-brand-100 bg-brand-50/50 p-4">
              <h3 className="font-semibold text-brand-900">
                包含 {formatPhoneme(activePhoneme)} 的单词
              </h3>
              {results.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">当前词库暂无相关单词</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {results.map((r) => (
                    <WordChip
                      key={r.word.id}
                      word={r.word.word}
                      sub={r.word.ipaFull}
                      highlight={r.matchedGrapheme}
                      onClick={() =>
                        navigate(`/word/${r.word.id}?p=${encodeURIComponent(activePhoneme)}`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-slate-400">点击音标卡片查看相关单词</p>
          )}
        </div>
      )}

      {words.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="w-full py-2 text-xs text-slate-400 underline"
        >
          清空本地词库
        </button>
      ) : null}

      <ConfirmModal
        open={showClearModal}
        title="清空本地词库"
        description={`将删除全部 ${words.length} 个单词、音标索引、拆解数据与练习进度，且无法恢复。确定继续吗？`}
        confirmLabel="全部清空"
        cancelLabel="取消"
        danger
        loading={clearing}
        onCancel={() => {
          if (!clearing) setShowClearModal(false)
        }}
        onConfirm={() => void confirmClear()}
      />
    </div>
  )
}
