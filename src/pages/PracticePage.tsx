import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  bumpRuleStreak,
  getGraphemeMaps,
  getWordPhonemes,
  listRuleCards,
  listWords,
} from '../db/repos'
import type { GraphemePhonemeMap, RuleCard, WordRecord } from '../db/schema'
import {
  checkPairMatch,
  checkPhonemeFind,
  generatePairMatch,
  generatePhonemeFind,
  type PairMatchQuestion,
  type PhonemeFindQuestion,
  type PracticeQuestion,
} from '../domain/practiceGen'
import { formatPhoneme } from '../domain/phonemeSplit'
import { speakPhoneme, speakWord } from '../services/speech/speakPhoneme'

type Mode = 'home' | 'phoneme-find' | 'pair-match'

export function PracticePage() {
  const [mode, setMode] = useState<Mode>('home')
  const [words, setWords] = useState<WordRecord[]>([])
  const [mapsByWord, setMapsByWord] = useState<Map<string, GraphemePhonemeMap[]>>(new Map())
  const [phonemeMap, setPhonemeMap] = useState<Map<string, string[]>>(new Map())
  const [cards, setCards] = useState<RuleCard[]>([])
  const [question, setQuestion] = useState<PracticeQuestion | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [pairPick, setPairPick] = useState<{ grapheme?: string; phoneme?: string }>({})
  const [userPairs, setUserPairs] = useState<Array<{ grapheme: string; phoneme: string }>>([])
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [score, setScore] = useState({ correct: 0, total: 0 })

  useEffect(() => {
    void (async () => {
      try {
        const w = (await listWords()).filter((x) => x.status === 'normal' && x.ipaFull)
        setWords(w)
        const map = new Map<string, GraphemePhonemeMap[]>()
        const pmap = new Map<string, string[]>()
        for (const word of w) {
          map.set(word.id, await getGraphemeMaps(word.id))
          const phs = await getWordPhonemes(word.id)
          for (const p of phs) {
            const list = pmap.get(p.phoneme) ?? []
            if (!list.includes(word.id)) list.push(word.id)
            pmap.set(p.phoneme, list)
          }
        }
        setMapsByWord(map)
        setPhonemeMap(pmap)
        setCards(await listRuleCards())
      } catch (e) {
        console.error('加载练习数据失败', e)
      }
    })()
  }, [mode, score.total])

  const canPractice = words.length >= 2

  function startPhonemeFind() {
    const q = generatePhonemeFind(words, phonemeMap)
    setQuestion(q)
    setSelected([])
    setFeedback('idle')
    setMode('phoneme-find')
  }

  function startPairMatch() {
    const prevId =
      question?.kind === 'pair-match' ? question.word.id : null
    const q = generatePairMatch(words, mapsByWord, prevId)
    setQuestion(q)
    setUserPairs([])
    setPairPick({})
    setFeedback('idle')
    setMode('pair-match')
  }

  function toggleSelect(id: string) {
    if (feedback !== 'idle') return
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function submitPhonemeFind() {
    if (!question || question.kind !== 'phoneme-find') return
    const ok = checkPhonemeFind(question, selected)
    setFeedback(ok ? 'correct' : 'wrong')
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
  }

  function onTapGrapheme(g: string) {
    if (feedback !== 'idle') return
    setPairPick((p) => ({ ...p, grapheme: g }))
  }

  function onTapPhoneme(ph: string) {
    if (feedback !== 'idle') return
    setPairPick((p) => {
      const next = { ...p, phoneme: ph }
      if (next.grapheme && next.phoneme) {
        setUserPairs((pairs) => {
          const filtered = pairs.filter((x) => x.grapheme !== next.grapheme)
          return [...filtered, { grapheme: next.grapheme!, phoneme: next.phoneme! }]
        })
        return {}
      }
      return next
    })
  }

  async function submitPairMatch() {
    if (!question || question.kind !== 'pair-match') return
    const ok = checkPairMatch(question, userPairs)
    setFeedback(ok ? 'correct' : 'wrong')
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
    // 尝试提升第一条规则 streak
    const first = question.pairs[0]
    if (first) await bumpRuleStreak(first.grapheme, first.phoneme, ok)
  }

  const remainingGraphemes = useMemo(() => {
    if (!question || question.kind !== 'pair-match') return []
    const used = new Set(userPairs.map((p) => p.grapheme))
    return question.graphemes.filter((g) => !used.has(g))
  }, [question, userPairs])

  const remainingPhonemes = useMemo(() => {
    if (!question || question.kind !== 'pair-match') return []
    const used = new Set(userPairs.map((p) => p.phoneme))
    return question.phonemes.filter((p) => !used.has(p))
  }, [question, userPairs])

  if (mode === 'home') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">轻量练习</h2>
          <p className="mt-1 text-sm text-slate-500">
            只基于当前已导入词库出题，一次练一个规律。
          </p>
        </div>

        {!canPractice ? (
          <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-slate-600">词库单词不足（至少 2 个带音标的词）</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
            >
              去导入单词
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={startPhonemeFind}
              className="w-full rounded-3xl border border-brand-200 bg-brand-50 px-4 py-5 text-left"
            >
              <div className="text-base font-bold text-brand-900">音标找单词</div>
              <div className="mt-1 text-sm text-brand-700">
                给出一个音标，选出包含它的单词
              </div>
            </button>
            <button
              type="button"
              onClick={startPairMatch}
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-5 text-left"
            >
              <div className="text-base font-bold text-slate-900">单词拆解配对</div>
              <div className="mt-1 text-sm text-slate-500">
                把字母组合和音标片段配对
              </div>
            </button>
            <Link
              to="/practice/cards"
              className="block w-full rounded-3xl border border-amber-200 bg-amber-50 px-4 py-5 text-left"
            >
              <div className="text-base font-bold text-amber-900">规律卡片</div>
              <div className="mt-1 text-sm text-amber-800">
                已点亮 {cards.filter((c) => c.unlocked).length} 张
              </div>
            </Link>
          </div>
        )}

        {score.total > 0 ? (
          <p className="text-center text-sm text-slate-500">
            本次正确 {score.correct}/{score.total}
          </p>
        ) : null}
      </div>
    )
  }

  if (!question) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-slate-500">暂时出不了题，再导入一些单词吧</p>
        <button type="button" className="text-brand-700" onClick={() => setMode('home')}>
          返回
        </button>
      </div>
    )
  }

  if (question.kind === 'phoneme-find') {
    return (
      <PhonemeFindView
        q={question}
        selected={selected}
        feedback={feedback}
        onToggle={toggleSelect}
        onSubmit={submitPhonemeFind}
        onNext={startPhonemeFind}
        onHome={() => setMode('home')}
      />
    )
  }

  return (
    <PairMatchView
      q={question}
      remainingGraphemes={remainingGraphemes}
      remainingPhonemes={remainingPhonemes}
      userPairs={userPairs}
      pairPick={pairPick}
      feedback={feedback}
      onTapGrapheme={onTapGrapheme}
      onTapPhoneme={onTapPhoneme}
      onSubmit={() => void submitPairMatch()}
      onNext={startPairMatch}
      onHome={() => setMode('home')}
    />
  )
}

function PhonemeFindView({
  q,
  selected,
  feedback,
  onToggle,
  onSubmit,
  onNext,
  onHome,
}: {
  q: PhonemeFindQuestion
  selected: string[]
  feedback: 'idle' | 'correct' | 'wrong'
  onToggle: (id: string) => void
  onSubmit: () => void
  onNext: () => void
  onHome: () => void
}) {
  // 揭晓后自动依次朗读正确答案单词；点卡片可重播
  useEffect(() => {
    if (feedback === 'idle') return
    let cancelled = false
    const correctWords = q.options.filter((w) => q.correctIds.includes(w.id))
    void (async () => {
      for (const w of correctWords) {
        if (cancelled) return
        await speakWord(w.word)
        if (cancelled) return
        await new Promise((r) => setTimeout(r, 280))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [feedback, q])

  return (
    <div className="space-y-5">
      <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
        ← 返回
      </button>
      <div className="rounded-3xl bg-brand-700 px-5 py-8 text-center text-white">
        <div className="text-sm text-brand-100">选出包含该音标的单词（可多选）</div>
        <button
          type="button"
          className="mt-3 text-4xl font-bold tracking-wide active:opacity-80"
          onClick={() => void speakPhoneme(q.phoneme)}
          aria-label={`朗读音标 ${formatPhoneme(q.phoneme)}`}
        >
          {formatPhoneme(q.phoneme)}
        </button>
        <p className="mt-2 text-xs text-brand-100/80">点音标可再听一遍</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((w) => {
          const on = selected.includes(w.id)
          const isCorrect = q.correctIds.includes(w.id)
          let cls = 'border-slate-200 bg-white'
          if (feedback === 'idle' && on) cls = 'border-brand-500 bg-brand-50'
          if (feedback !== 'idle' && isCorrect) cls = 'border-green-500 bg-green-50'
          if (feedback === 'wrong' && on && !isCorrect) cls = 'border-red-400 bg-red-50'
          const revealed = feedback !== 'idle'
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                if (revealed) {
                  void speakWord(w.word)
                  return
                }
                // 选中时播放；取消选中不播放
                if (!on) void speakWord(w.word)
                onToggle(w.id)
              }}
              className={`rounded-2xl border-2 px-3 py-4 text-center font-semibold transition active:scale-[0.98] ${cls}`}
              aria-label={
                revealed
                  ? `朗读单词 ${w.word}`
                  : on
                    ? `取消选择 ${w.word}`
                    : `选择并朗读 ${w.word}`
              }
            >
              {w.word}
              {revealed ? (
                <span className="mt-1 block text-[10px] font-medium text-slate-400">
                  点按重播
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {feedback === 'idle' ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={selected.length === 0}
          className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white disabled:opacity-50"
        >
          提交
        </button>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-2xl px-4 py-3 text-center font-medium ${
              feedback === 'correct' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback === 'correct' ? '答对了！' : '再看一眼高亮答案哦'}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  )
}

function PairMatchView({
  q,
  remainingGraphemes,
  remainingPhonemes,
  userPairs,
  pairPick,
  feedback,
  onTapGrapheme,
  onTapPhoneme,
  onSubmit,
  onNext,
  onHome,
}: {
  q: PairMatchQuestion
  remainingGraphemes: string[]
  remainingPhonemes: string[]
  userPairs: Array<{ grapheme: string; phoneme: string }>
  pairPick: { grapheme?: string; phoneme?: string }
  feedback: 'idle' | 'correct' | 'wrong'
  onTapGrapheme: (g: string) => void
  onTapPhoneme: (p: string) => void
  onSubmit: () => void
  onNext: () => void
  onHome: () => void
}) {
  // 揭晓结果后自动读单词；点卡片可重播
  useEffect(() => {
    if (feedback === 'idle') return
    void speakWord(q.word.word)
  }, [feedback, q.word.id, q.word.word])

  return (
    <div className="space-y-5">
      <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
        ← 返回
      </button>
      <button
        type="button"
        disabled={feedback === 'idle'}
        onClick={() => {
          if (feedback !== 'idle') void speakWord(q.word.word)
        }}
        className={[
          'w-full rounded-3xl bg-slate-900 px-5 py-6 text-center text-white transition',
          feedback !== 'idle' ? 'active:scale-[0.99] active:opacity-95' : '',
        ].join(' ')}
        aria-label={
          feedback === 'idle' ? q.word.word : `朗读单词 ${q.word.word}，可再次点击重播`
        }
      >
        <div className="text-sm text-slate-300">把字母组合与音标配对</div>
        <div className="mt-2 text-3xl font-bold tracking-widest">{q.word.word}</div>
        {feedback === 'idle' ? (
          <div className="mt-2 text-sm text-slate-400">完整音标将在提交后揭晓</div>
        ) : (
          <>
            <div className="mt-1 text-xl text-brand-200">{q.word.ipaFull}</div>
            <div className="mt-2 text-xs text-slate-400">点卡片可再听一遍</div>
          </>
        )}
      </button>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-600">字母组合</h3>
        <div className="flex flex-wrap gap-2">
          {remainingGraphemes.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onTapGrapheme(g)}
              className={[
                'rounded-xl border-2 px-4 py-2 font-bold',
                pairPick.grapheme === g
                  ? 'border-accent bg-accent-soft'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-600">音标</h3>
        <div className="flex flex-wrap gap-2">
          {remainingPhonemes.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                void speakPhoneme(p)
                onTapPhoneme(p)
              }}
              className={[
                'rounded-xl border-2 px-4 py-2 font-bold transition active:scale-[0.98]',
                pairPick.phoneme === p
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              {formatPhoneme(p)}
            </button>
          ))}
        </div>
      </div>

      {userPairs.length > 0 ? (
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <div className="text-xs text-slate-500">已配对</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {userPairs.map((p) => (
              <button
                key={`${p.grapheme}-${p.phoneme}`}
                type="button"
                className="rounded-full bg-white px-3 py-1 text-sm shadow-sm"
                onClick={() => void speakPhoneme(p.phoneme)}
              >
                {p.grapheme} → {formatPhoneme(p.phoneme)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {feedback === 'idle' ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={userPairs.length !== q.pairs.length}
          className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white disabled:opacity-50"
        >
          提交配对
        </button>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-2xl px-4 py-3 text-center font-medium ${
              feedback === 'correct' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback === 'correct' ? '配对正确！' : '再试一次，对照拆解页看看'}
          </div>
          {feedback === 'wrong' ? (
            <div className="text-center text-sm text-slate-500">
              参考：{q.pairs.map((p) => `${p.grapheme}→${formatPhoneme(p.phoneme)}`).join('，')}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  )
}
