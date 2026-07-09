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
import { speakPhoneme } from '../services/speech/speakPhoneme'

type Mode = 'home' | 'phoneme-find' | 'pair-match' | 'cards'

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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

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
            <button
              type="button"
              onClick={() => setMode('cards')}
              className="w-full rounded-3xl border border-amber-200 bg-amber-50 px-4 py-5 text-left"
            >
              <div className="text-base font-bold text-amber-900">规律卡片</div>
              <div className="mt-1 text-sm text-amber-800">
                已点亮 {cards.filter((c) => c.unlocked).length} 张
              </div>
            </button>
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

  if (mode === 'cards') {
    const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null
    // 优先用卡片记录的例词；若为空则从当前词库映射反查
    const relatedWords: WordRecord[] = (() => {
      if (!selectedCard) return []
      const byId = new Map(words.map((w) => [w.id, w]))
      const fromCard = selectedCard.exampleWordIds
        .map((id) => byId.get(id))
        .filter((w): w is WordRecord => Boolean(w))

      const fromMaps: WordRecord[] = []
      for (const w of words) {
        const maps = mapsByWord.get(w.id) ?? []
        if (
          maps.some(
            (m) =>
              m.grapheme === selectedCard.grapheme && m.phoneme === selectedCard.phoneme,
          )
        ) {
          fromMaps.push(w)
        }
      }

      const merged = new Map<string, WordRecord>()
      for (const w of [...fromCard, ...fromMaps]) merged.set(w.id, w)
      return Array.from(merged.values()).sort((a, b) => a.word.localeCompare(b.word))
    })()

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedCardId(null)
            setMode('home')
          }}
          className="text-sm font-medium text-brand-700"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-lg font-bold">规律卡片</h2>
          <p className="mt-1 text-sm text-slate-500">点击卡片查看关联单词，再进入拆解页讲解</p>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500">导入更多单词后会自动点亮规律卡片</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {cards.map((c) => {
                const active = selectedCardId === c.id
                return (
                  <div
                    key={c.id}
                    className={[
                      'rounded-2xl border px-3 py-4 text-center transition',
                      active
                        ? 'border-amber-500 bg-amber-100 shadow-md ring-2 ring-amber-200'
                        : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      className="w-full active:scale-[0.98]"
                      onClick={() => {
                        void speakPhoneme(c.phoneme)
                        setSelectedCardId((id) => (id === c.id ? null : c.id))
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
                        {active ? '收起例词' : '点击听音 · 查看例词'}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            {selectedCard ? (
              <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => void speakPhoneme(selectedCard.phoneme)}
                  >
                    <span className="text-brand-700">{selectedCard.grapheme}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-brand-700">{formatPhoneme(selectedCard.phoneme)}</span>
                  </button>
                  <span className="ml-2 font-normal text-slate-500">
                    关联 {relatedWords.length} 个词
                  </span>
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  在这些单词里，该字母组合与音标最相关（教学向展示，非绝对规律）。
                </p>
                {relatedWords.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    暂无关联单词（可能词条已删除）。可重新导入含该规律的词。
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {relatedWords.map((w) => (
                      <li key={w.id}>
                        <Link
                          to={`/word/${w.id}?p=${encodeURIComponent(selectedCard.phoneme)}`}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 active:bg-brand-50"
                        >
                          <div>
                            <div className="font-semibold tracking-wide text-slate-900">
                              {w.word}
                            </div>
                            <div className="text-xs text-slate-500">{w.ipaFull}</div>
                          </div>
                          <span className="text-sm text-brand-700">拆解 →</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <p className="text-center text-sm text-slate-400">点选上方卡片查看例词</p>
            )}
          </>
        )}
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
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onToggle(w.id)}
              className={`rounded-2xl border-2 px-3 py-4 text-center font-semibold ${cls}`}
            >
              {w.word}
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
  return (
    <div className="space-y-5">
      <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
        ← 返回
      </button>
      <div className="rounded-3xl bg-slate-900 px-5 py-6 text-center text-white">
        <div className="text-sm text-slate-300">把字母组合与音标配对</div>
        <div className="mt-2 text-3xl font-bold tracking-widest">{q.word.word}</div>
        {feedback === 'idle' ? (
          <div className="mt-2 text-sm text-slate-400">完整音标将在提交后揭晓</div>
        ) : (
          <div className="mt-1 text-xl text-brand-200">{q.word.ipaFull}</div>
        )}
      </div>

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
