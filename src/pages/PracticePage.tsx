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
  checkListenChoose,
  checkPairMatch,
  checkPhonemeFind,
  generateListenChooseSession,
  generatePairMatch,
  generatePhonemeFind,
  LISTEN_CHOOSE_SESSION_SIZE,
  type ListenChooseQuestion,
  type PairMatchQuestion,
  type PhonemeFindQuestion,
  type PracticeQuestion,
} from '../domain/practiceGen'
import { formatPhoneme } from '../domain/phonemeSplit'
import { speakPhoneme, speakWord } from '../services/speech/speakPhoneme'

type Mode = 'home' | 'phoneme-find' | 'pair-match' | 'listen-choose' | 'listen-result'

/** 听音一轮中每一题的作答记录（选择题复盘 / 誊写对照清单共用） */
type ListenRecord = {
  answer: string
  options: string[]
  /** 选择题：用户选项；誊写模式：始终 null */
  pick: string | null
  /** 选择题：是否正确；誊写模式：null */
  ok: boolean | null
}

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
  /** 听音选音标：一整轮 30 题 */
  const [listenSession, setListenSession] = useState<ListenChooseQuestion[]>([])
  const [listenIndex, setListenIndex] = useState(0)
  const [listenPick, setListenPick] = useState<string | null>(null)
  const [listenScore, setListenScore] = useState({ correct: 0, total: 0 })
  /** 首页开关：下一轮是否用纸质誊写 */
  const [listenWritePref, setListenWritePref] = useState(false)
  /** 当前轮是否为誊写模式（开局锁定） */
  const [listenWriteMode, setListenWriteMode] = useState(false)
  const [listenRecords, setListenRecords] = useState<ListenRecord[]>([])

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

  function startListenChoose(writeMode = listenWritePref) {
    const session = generateListenChooseSession(LISTEN_CHOOSE_SESSION_SIZE)
    setListenSession(session)
    setListenIndex(0)
    setListenPick(null)
    setListenScore({ correct: 0, total: 0 })
    setListenRecords([])
    setListenWriteMode(writeMode)
    setFeedback('idle')
    setMode('listen-choose')
  }

  function pickListenChoose(phoneme: string) {
    if (listenWriteMode || feedback !== 'idle') return
    const q = listenSession[listenIndex]
    if (!q) return
    const ok = checkListenChoose(q, phoneme)
    setListenPick(phoneme)
    setFeedback(ok ? 'correct' : 'wrong')
    setListenRecords((prev) => [
      ...prev,
      { answer: q.answer, options: q.options, pick: phoneme, ok },
    ])
    setListenScore((s) => ({
      correct: s.correct + (ok ? 1 : 0),
      total: s.total + 1,
    }))
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
  }

  /** 誊写模式：本题听完进入下一题，不记对错 */
  function advanceListenWrite() {
    if (!listenWriteMode) return
    const q = listenSession[listenIndex]
    if (!q) return
    setListenRecords((prev) => [
      ...prev,
      { answer: q.answer, options: q.options, pick: null, ok: null },
    ])
    if (listenIndex + 1 >= listenSession.length) {
      setMode('listen-result')
      return
    }
    setListenIndex((i) => i + 1)
    setListenPick(null)
    setFeedback('idle')
  }

  function nextListenChoose() {
    if (listenIndex + 1 >= listenSession.length) {
      setMode('listen-result')
      return
    }
    setListenIndex((i) => i + 1)
    setListenPick(null)
    setFeedback('idle')
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

  /** 两侧都选中则写入配对；否则只更新选中态。顺序不限：字母→音标 或 音标→字母 均可。 */
  function completeOrPick(next: { grapheme?: string; phoneme?: string }) {
    if (next.grapheme && next.phoneme) {
      setUserPairs((pairs) => {
        const filtered = pairs.filter(
          (x) => x.grapheme !== next.grapheme && x.phoneme !== next.phoneme,
        )
        return [...filtered, { grapheme: next.grapheme!, phoneme: next.phoneme! }]
      })
      setPairPick({})
    } else {
      setPairPick(next)
    }
  }

  function onTapGrapheme(g: string) {
    if (feedback !== 'idle') return
    completeOrPick({ ...pairPick, grapheme: g })
  }

  function onTapPhoneme(ph: string) {
    if (feedback !== 'idle') return
    completeOrPick({ ...pairPick, phoneme: ph })
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
            听音辨音不依赖词库；找词与配对基于已导入单词。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 px-4 py-5 text-left">
            <div className="text-base font-bold text-violet-900">听音选音标</div>
            <div className="mt-1 text-sm text-violet-800">
              听 48 音标录音 · 每轮 {LISTEN_CHOOSE_SESSION_SIZE} 题
              {listenWritePref
                ? ' · 纸质誊写（无选项，结束给对照清单）'
                : ' · 四选一，结束可复盘错题'}
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-violet-200/80 bg-white/70 px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
                checked={listenWritePref}
                onChange={(e) => setListenWritePref(e.target.checked)}
              />
              <span className="text-sm text-violet-900">
                <span className="font-semibold">纸质誊写模式</span>
                <span className="mt-0.5 block text-xs text-violet-700/90">
                  开启后不显示选项，便于在纸上写出音标；结束后按顺序给出对照清单
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => startListenChoose()}
              className="mt-3 w-full rounded-2xl bg-violet-700 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 active:scale-[0.99]"
            >
              {listenWritePref ? '开始誊写测试' : '开始选择测试'}
            </button>
          </div>
          <Link
            to="/practice/cards"
            className="block w-full rounded-3xl border border-amber-200 bg-amber-50 px-4 py-5 text-left transition hover:border-amber-300"
          >
            <div className="text-base font-bold text-amber-900">规律卡片</div>
            <div className="mt-1 text-sm text-amber-800">
              已点亮 {cards.filter((c) => c.unlocked).length} 张
            </div>
          </Link>
        </div>

        {canPractice ? (
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={startPhonemeFind}
              className="w-full rounded-3xl border border-brand-200 bg-brand-50 px-4 py-5 text-left transition hover:border-brand-300"
            >
              <div className="text-base font-bold text-brand-900">音标找单词</div>
              <div className="mt-1 text-sm text-brand-700">
                给出一个音标，选出包含它的单词
              </div>
            </button>
            <button
              type="button"
              onClick={startPairMatch}
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-5 text-left transition hover:border-slate-300"
            >
              <div className="text-base font-bold text-slate-900">单词拆解配对</div>
              <div className="mt-1 text-sm text-slate-500">
                把字母组合和音标片段配对
              </div>
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <p className="text-sm text-slate-600">
              词库不足 2 个带音标的词时，找词 / 配对暂不可用
            </p>
            <Link
              to="/"
              className="mt-3 inline-block rounded-2xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
            >
              去导入单词
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

  if (mode === 'listen-result') {
    return (
      <ListenResultView
        writeMode={listenWriteMode}
        score={listenScore}
        total={listenSession.length || LISTEN_CHOOSE_SESSION_SIZE}
        records={listenRecords}
        onRetry={() => startListenChoose(listenWriteMode)}
        onHome={() => setMode('home')}
      />
    )
  }

  if (mode === 'listen-choose') {
    const q = listenSession[listenIndex]
    if (!q) {
      return (
        <div className="space-y-3 py-8 text-center">
          <p className="text-slate-500">出题失败，请重试</p>
          <button type="button" className="text-brand-700" onClick={() => setMode('home')}>
            返回
          </button>
        </div>
      )
    }
    return (
      <ListenChooseView
        q={q}
        index={listenIndex}
        total={listenSession.length}
        writeMode={listenWriteMode}
        sessionCorrect={listenScore.correct}
        pick={listenPick}
        feedback={feedback}
        onPick={pickListenChoose}
        onNext={nextListenChoose}
        onAdvanceWrite={advanceListenWrite}
        onHome={() => setMode('home')}
      />
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

  if (question.kind === 'pair-match') {
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

  return (
    <div className="space-y-3 py-8 text-center">
      <p className="text-slate-500">未知练习类型</p>
      <button type="button" className="text-brand-700" onClick={() => setMode('home')}>
        返回
      </button>
    </div>
  )
}

/** 听音练习用：简洁线面结合的喇叭图标 */
function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.5 9.5v5a1.5 1.5 0 0 0 1.5 1.5h2.2l4.4 3.3a1 1 0 0 0 1.6-.8V6a1 1 0 0 0-1.6-.8L8.2 8.5H6A1.5 1.5 0 0 0 4.5 10Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M16.2 9.2a3.2 3.2 0 0 1 0 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.2 7a5.8 5.8 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

function ListenChooseView({
  q,
  index,
  total,
  writeMode,
  sessionCorrect,
  pick,
  feedback,
  onPick,
  onNext,
  onAdvanceWrite,
  onHome,
}: {
  q: ListenChooseQuestion
  index: number
  total: number
  writeMode: boolean
  sessionCorrect: number
  pick: string | null
  feedback: 'idle' | 'correct' | 'wrong'
  onPick: (phoneme: string) => void
  onNext: () => void
  onAdvanceWrite: () => void
  onHome: () => void
}) {
  // 选择题：进入新题 / 揭晓后朗读；誊写：仅换题时朗读（不提前揭晓答案）
  useEffect(() => {
    if (writeMode && feedback !== 'idle') return
    void speakPhoneme(q.answer)
  }, [q.answer, index, feedback, writeMode])

  // 誊写按「当前题序」推进进度条；选择按「已作答」
  const barPct = writeMode
    ? Math.round((index / total) * 100)
    : Math.round(((index + (feedback === 'idle' ? 0 : 1)) / total) * 100)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
          ← 返回
        </button>
        <div className="text-sm text-slate-500">
          {writeMode
            ? `誊写 ${index + 1}/${total}`
            : `第 ${index + 1}/${total} 题 · 已对 ${sessionCorrect}`}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="rounded-3xl bg-violet-700 px-5 py-10 text-center text-white">
        <div className="text-sm text-violet-100">
          {writeMode ? '仔细听，把听到的音标写在纸上' : '仔细听，选出你听到的音标'}
        </div>
        <button
          type="button"
          onClick={() => void speakPhoneme(q.answer)}
          className="group relative mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-white text-violet-700 shadow-lg shadow-violet-950/20 ring-4 ring-white/25 transition hover:scale-[1.03] hover:shadow-xl active:scale-95"
          aria-label="重新朗读音标"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-white/20 opacity-0 transition group-hover:opacity-100"
          />
          <SpeakerIcon className="relative h-10 w-10" />
        </button>
        <p className="mt-4 text-xs text-violet-100/90">点按钮可再听一遍</p>
        {writeMode ? (
          <p className="mt-4 text-sm text-violet-200">本模式不显示选项，听完写在纸上即可</p>
        ) : feedback !== 'idle' ? (
          <p className="mt-4 text-2xl font-bold tracking-wide text-white">
            正确答案 {formatPhoneme(q.answer)}
          </p>
        ) : (
          <p className="mt-4 text-sm text-violet-200">选项中有 3 个相近干扰音</p>
        )}
      </div>

      {writeMode ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center text-sm text-violet-800">
            在纸上写出第 {index + 1} 题的音标后，点下方进入下一题。
            <br />
            全部结束后会按顺序给出对照清单。
          </div>
          <button
            type="button"
            onClick={onAdvanceWrite}
            className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white"
          >
            {index + 1 >= total ? '完成，查看对照清单' : '写好了，下一题'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((p) => {
              let cls = 'border-slate-200 bg-white text-slate-900'
              if (feedback === 'idle') {
                cls = 'border-slate-200 bg-white hover:border-violet-300'
              } else if (p === q.answer) {
                cls = 'border-green-500 bg-green-50 text-green-800'
              } else if (p === pick) {
                cls = 'border-red-400 bg-red-50 text-red-700'
              } else {
                cls = 'border-slate-100 bg-slate-50 text-slate-400'
              }
              return (
                <button
                  key={p}
                  type="button"
                  disabled={feedback !== 'idle'}
                  onClick={() => {
                    if (feedback !== 'idle') return
                    onPick(p)
                  }}
                  className={`rounded-2xl border-2 px-3 py-5 text-center text-2xl font-bold transition active:scale-[0.98] disabled:cursor-default ${cls}`}
                  aria-label={`选择 ${formatPhoneme(p)}`}
                >
                  {formatPhoneme(p)}
                </button>
              )
            })}
          </div>

          {feedback !== 'idle' ? (
            <div className="space-y-3">
              <div
                className={`rounded-2xl px-4 py-3 text-center font-medium ${
                  feedback === 'correct' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {feedback === 'correct' ? '听对了！' : `选成了 ${formatPhoneme(pick ?? '')}`}
              </div>
              <button
                type="button"
                onClick={onNext}
                className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white"
              >
                {index + 1 >= total ? '查看成绩与错题' : '下一题'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function ListenResultView({
  writeMode,
  score,
  total,
  records,
  onRetry,
  onHome,
}: {
  writeMode: boolean
  score: { correct: number; total: number }
  total: number
  records: ListenRecord[]
  onRetry: () => void
  onHome: () => void
}) {
  const wrongs = records
    .map((r, i) => ({ ...r, no: i + 1 }))
    .filter((r) => r.ok === false)

  if (writeMode) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
          ← 返回
        </button>
        <div className="rounded-3xl bg-violet-700 px-5 py-8 text-center text-white">
          <div className="text-sm text-violet-100">纸质誊写完成</div>
          <div className="mt-2 text-2xl font-bold">对照清单（共 {records.length || total} 题）</div>
          <p className="mt-3 text-sm text-violet-100/90">
            按题号对照纸上答案；点音标可再听一遍
          </p>
        </div>

        <ol className="space-y-2">
          {records.map((r, i) => (
            <li key={`${i}-${r.answer}`}>
              <button
                type="button"
                onClick={() => void speakPhoneme(r.answer)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99]"
                aria-label={`第 ${i + 1} 题，朗读 ${formatPhoneme(r.answer)}`}
              >
                <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-slate-400">
                  {i + 1}.
                </span>
                <span className="flex-1 text-xl font-bold tracking-wide text-slate-900">
                  {formatPhoneme(r.answer)}
                </span>
                <span className="text-violet-600">
                  <SpeakerIcon className="h-5 w-5" />
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-2xl bg-violet-700 py-3 font-semibold text-white"
          >
            再誊写一轮
          </button>
          <button
            type="button"
            onClick={onHome}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-800"
          >
            回练习首页
          </button>
        </div>
      </div>
    )
  }

  const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0
  const line =
    pct >= 90 ? '耳力很棒，继续保持！' : pct >= 70 ? '不错，再练几轮会更稳' : '多听几遍相近音，会进步很快'

  return (
    <div className="space-y-5">
      <button type="button" onClick={onHome} className="text-sm font-medium text-brand-700">
        ← 返回
      </button>
      <div className="rounded-3xl bg-violet-700 px-5 py-10 text-center text-white">
        <div className="text-sm text-violet-100">本轮听音测试完成</div>
        <div className="mt-3 text-5xl font-bold tabular-nums">
          {score.correct}
          <span className="text-2xl font-semibold text-violet-200">/{total}</span>
        </div>
        <div className="mt-2 text-lg text-violet-100">正确率 {pct}%</div>
        <p className="mt-4 text-sm text-violet-100/90">{line}</p>
      </div>

      {wrongs.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            错题复盘（{wrongs.length} 题）
          </h3>
          <p className="text-xs text-slate-500">对照你的选项与正确答案；点可重听标准音</p>
          <ul className="space-y-2">
            {wrongs.map((w) => (
              <li
                key={`wrong-${w.no}-${w.answer}`}
                className="rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-red-600/80">第 {w.no} 题</div>
                  <button
                    type="button"
                    onClick={() => void speakPhoneme(w.answer)}
                    className="shrink-0 rounded-full bg-white p-1.5 text-violet-700 shadow-sm ring-1 ring-violet-100 transition active:scale-95"
                    aria-label={`重听第 ${w.no} 题正确答案`}
                  >
                    <SpeakerIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-500">
                    你的选项{' '}
                    <span className="font-bold text-red-700">
                      {formatPhoneme(w.pick ?? '')}
                    </span>
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="text-slate-500">
                    正确答案{' '}
                    <span className="font-bold text-green-700">
                      {formatPhoneme(w.answer)}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
          全部答对，没有错题
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-2xl bg-violet-700 py-3 font-semibold text-white"
        >
          再测一轮
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-800"
        >
          回练习首页
        </button>
      </div>
    </div>
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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

      <div className="text-center">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">字母组合</h3>
        <div className="flex flex-wrap justify-center gap-2">
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

      <div className="text-center">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">音标</h3>
        <div className="flex flex-wrap justify-center gap-2">
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
        <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
          <div className="text-xs text-slate-500">已配对</div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
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
