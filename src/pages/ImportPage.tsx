import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProcessingSteps } from '../components/ProcessingSteps'
import { countStats, createImportDraft, createManualImport } from '../db/repos'
import { parseManualWords } from '../domain/wordClean'
import { tesseractOcr } from '../services/ocr/tesseractOcr'

type Phase = 'idle' | 'ocr' | 'clean' | 'done' | 'error'

export function ImportPage() {
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [manual, setManual] = useState('')
  const [stats, setStats] = useState({ wordCount: 0, phonemeCount: 0, ruleCount: 0 })

  useEffect(() => {
    void countStats().then(setStats)
  }, [])

  async function handleFile(file: File, sourceType: 'camera' | 'gallery') {
    setPhase('ocr')
    setMessage('正在提取英文内容…')
    setProgress(0.1)
    try {
      const result = await tesseractOcr.recognize(file, (p) => {
        setProgress(p.progress)
        setMessage(p.message)
        if (p.stage === 'recognizing') setPhase('ocr')
      })

      setPhase('clean')
      setMessage('正在清洗单词…')
      setProgress(0.92)

      const record = await createImportDraft({
        sourceType,
        ocrRawText: result.rawText,
        candidateWords: result.candidates,
      })

      setPhase('done')
      setProgress(1)
      setMessage('准备进入校对…')
      navigate(`/review/${record.id}`)
    } catch (e) {
      console.error(e)
      setPhase('error')
      setMessage(e instanceof Error ? e.message : '识别失败，请重试或改用手动补录')
    }
  }

  async function handleManual() {
    const words = parseManualWords(manual)
    if (words.length === 0) {
      setPhase('error')
      setMessage('请输入至少一个有效英文单词')
      return
    }
    const record = await createManualImport(words)
    navigate(`/review/${record.id}`)
  }

  const steps = [
    {
      key: 'ocr',
      label: '正在提取英文内容',
      done: phase === 'clean' || phase === 'done',
      active: phase === 'ocr',
    },
    {
      key: 'clean',
      label: '正在清洗单词',
      done: phase === 'done',
      active: phase === 'clean',
    },
    {
      key: 'ipa',
      label: '确认后生成音标库',
      done: false,
      active: false,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lg">
        <h2 className="text-xl font-bold">拍照即建库</h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-100">
          拍摄绘本、单词卡或上传截图，快速整理英文单词与英式音标，方便边讲边看。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <div className="text-lg font-bold">{stats.wordCount}</div>
            <div className="text-brand-100">单词</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <div className="text-lg font-bold">{stats.phonemeCount}</div>
            <div className="text-brand-100">音标</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <div className="text-lg font-bold">{stats.ruleCount}</div>
            <div className="text-brand-100">规律</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={phase === 'ocr' || phase === 'clean'}
          onClick={() => cameraRef.current?.click()}
          className="rounded-3xl border border-brand-200 bg-brand-50 px-4 py-8 text-center shadow-sm active:scale-[0.98] disabled:opacity-60"
        >
          <div className="text-2xl">📷</div>
          <div className="mt-2 font-semibold text-brand-800">拍照导入</div>
          <div className="mt-1 text-xs text-brand-600">调用相机</div>
        </button>
        <button
          type="button"
          disabled={phase === 'ocr' || phase === 'clean'}
          onClick={() => galleryRef.current?.click()}
          className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm active:scale-[0.98] disabled:opacity-60"
        >
          <div className="text-2xl">🖼️</div>
          <div className="mt-2 font-semibold text-slate-800">上传图片</div>
          <div className="mt-1 text-xs text-slate-500">相册 / 截图</div>
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f, 'camera')
            e.target.value = ''
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f, 'gallery')
            e.target.value = ''
          }}
        />
      </section>

      {(phase === 'ocr' || phase === 'clean') && (
        <section className="space-y-3">
          <ProcessingSteps steps={steps} />
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-center text-sm text-slate-500">{message}</p>
        </section>
      )}

      {phase === 'error' && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-800">手动补录单词</h3>
        <p className="mt-1 text-xs text-slate-500">
          OCR 不完美时，可直接粘贴或输入英文单词（空格/逗号分隔）
        </p>
        <textarea
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          rows={3}
          placeholder="例如：phone fish ship green"
          className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="button"
          onClick={() => void handleManual()}
          className="mt-3 w-full rounded-2xl bg-brand-700 py-3 text-sm font-semibold text-white active:bg-brand-800"
        >
          进入校对并导入
        </button>
      </section>

      <div className="flex gap-3 text-sm">
        <Link
          to="/library"
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center font-medium text-slate-700"
        >
          查看词库
        </Link>
        <Link
          to="/practice"
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-center font-medium text-slate-700"
        >
          去练习
        </Link>
      </div>
    </div>
  )
}
