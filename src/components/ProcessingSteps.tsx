export interface Step {
  key: string
  label: string
  done: boolean
  active: boolean
}

export function ProcessingSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li
          key={s.key}
          className={[
            'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
            s.active
              ? 'border-brand-200 bg-brand-50 text-brand-800'
              : s.done
                ? 'border-slate-100 bg-slate-50 text-slate-600'
                : 'border-slate-100 text-slate-400',
          ].join(' ')}
        >
          <span
            className={[
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              s.done
                ? 'bg-brand-600 text-white'
                : s.active
                  ? 'bg-brand-200 text-brand-800'
                  : 'bg-slate-200 text-slate-500',
            ].join(' ')}
          >
            {s.done ? '✓' : s.active ? '…' : '·'}
          </span>
          <span className="font-medium">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
