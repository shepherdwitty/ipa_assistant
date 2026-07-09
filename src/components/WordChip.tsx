export function WordChip({
  word,
  lowConfidence,
  onRemove,
  onClick,
  highlight,
  sub,
}: {
  word: string
  lowConfidence?: boolean
  onRemove?: () => void
  onClick?: () => void
  highlight?: string | null
  sub?: string | null
}) {
  const content =
    highlight && word.includes(highlight) ? (
      <>
        {word.split(new RegExp(`(${highlight})`, 'i')).map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="rounded bg-accent-soft px-0.5 text-amber-900">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    ) : (
      word
    )

  return (
    <div
      className={[
        'inline-flex max-w-full items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm',
        lowConfidence
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-white text-slate-800',
        onClick ? 'cursor-pointer active:scale-[0.98]' : '',
      ].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="min-w-0">
        <div className="font-semibold tracking-wide">{content}</div>
        {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label={`删除 ${word}`}
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
