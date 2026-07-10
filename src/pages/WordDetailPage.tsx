import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlignmentView } from '../components/AlignmentView'
import { ConfirmModal } from '../components/ConfirmModal'
import { deleteWord, getGraphemeMaps, getWord, refreshWordIpa } from '../db/repos'
import type { GraphemePhonemeMap, WordRecord } from '../db/schema'
import { speakWord } from '../services/speech/speakPhoneme'

/** 从规律卡片 / 词库等入口带入，用于正确返回上一页 */
export type WordDetailLocationState = {
  backTo?: string
  backLabel?: string
}

export function WordDetailPage() {
  const { wordId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [search] = useSearchParams()
  const focusPhoneme = search.get('p')
  const navState = (location.state as WordDetailLocationState | null) ?? null
  const backTo = navState?.backTo || '/library'
  const backLabel = navState?.backLabel || '返回词库'
  const [word, setWord] = useState<WordRecord | null>(null)
  const [maps, setMaps] = useState<GraphemePhonemeMap[]>([])
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  async function load(id: string) {
    const w = await getWord(id)
    if (!w) {
      setError('单词不存在')
      return
    }
    setWord(w)
    setMaps(await getGraphemeMaps(id))
  }

  useEffect(() => {
    if (!wordId) return
    void load(wordId)
  }, [wordId])

  // 进入详情后自动朗读单词（词库 / 规律卡片等入口一致）
  useEffect(() => {
    if (!word?.word) return
    void speakWord(word.word)
  }, [word?.id, word?.word])

  async function handleRetry() {
    if (!wordId) return
    setRetrying(true)
    setRetryMsg('')
    try {
      const updated = await refreshWordIpa(wordId)
      if (updated?.status === 'normal' && updated.ipaFull) {
        setWord(updated)
        setMaps(await getGraphemeMaps(wordId))
        setRetryMsg('已重新生成音标与拆解')
      } else {
        setRetryMsg('仍未查到音标，可稍后再试或换词导入')
        if (updated) setWord(updated)
      }
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : '重试失败')
    } finally {
      setRetrying(false)
    }
  }

  async function confirmDelete() {
    if (!wordId || !word) return
    setDeleting(true)
    try {
      await deleteWord(wordId)
      navigate(backTo, { replace: true })
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : '删除失败')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={backTo} className="text-brand-700 underline">
          {backLabel}
        </Link>
      </div>
    )
  }

  if (!word) {
    return <div className="py-12 text-center text-slate-500">加载中…</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="text-sm font-medium text-brand-700">
          ← {backLabel}
        </Link>
        <span
          className={[
            'rounded-full px-2.5 py-1 text-xs font-medium',
            word.status === 'normal'
              ? 'bg-brand-50 text-brand-700'
              : 'bg-amber-50 text-amber-700',
          ].join(' ')}
        >
          {word.status === 'normal' ? '已生成音标' : '待确认'}
        </span>
      </div>

      <AlignmentView
        word={word.word}
        ipaFull={word.ipaFull}
        maps={maps}
        focusPhoneme={focusPhoneme}
      />

      {word.syllables ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">音节切分：</span>
          <span className="font-medium text-slate-800">{word.syllables}</span>
        </div>
      ) : null}

      {word.status === 'pending' ? (
        <div className="space-y-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            内置词表未收录，且在线词典也可能没有音标字段（例如 Free Dictionary 对部分词返回
            phonetics: []），所以落成「待确认」。
          </p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => void handleRetry()}
            className="w-full rounded-xl bg-amber-700 py-2.5 font-semibold text-white disabled:opacity-60 md:max-w-xs"
          >
            {retrying ? '正在重新查询…' : '重新生成音标'}
          </button>
          {retryMsg ? <p className="text-center text-xs text-amber-800 md:text-left">{retryMsg}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={deleting}
        onClick={() => setShowDeleteModal(true)}
        className="w-full rounded-2xl border border-red-200 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-50 disabled:opacity-50 md:max-w-xs"
      >
        删除此单词
      </button>

      <ConfirmModal
        open={showDeleteModal}
        title="删除单词"
        description={`确定删除「${word.word}」吗？删除后音标索引与拆解数据也会一并清除，且无法恢复。`}
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        loading={deleting}
        onCancel={() => {
          if (!deleting) setShowDeleteModal(false)
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
