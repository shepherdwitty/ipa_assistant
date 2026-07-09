import { speakPhoneme } from '../services/speech/speakPhoneme'

export function PhonemeCard({
  phoneme,
  label,
  tip,
  active,
  count,
  onClick,
}: {
  /** 用于朗读的纯音标，如 f、ʃ */
  phoneme: string
  label: string
  tip?: string
  active?: boolean
  count?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void speakPhoneme(phoneme)
        onClick?.()
      }}
      className={[
        'w-full rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]',
        active
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-brand-200',
      ].join(' ')}
    >
      <div className="text-lg font-bold text-brand-800">{label}</div>
      {tip ? <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{tip}</div> : null}
      {typeof count === 'number' ? (
        <div className="mt-1 text-xs font-medium text-slate-400">{count} 个词</div>
      ) : null}
    </button>
  )
}
