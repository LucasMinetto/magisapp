import { useId } from 'react'
import { fromParts, toParts, weekdayName } from '@shared/gameTime'
import { Chip } from '.'

interface Props {
  label: string
  epochDate: string
  value: number | null
  onChange: (minute: number | null) => void
  error?: string | null
}

/** Data e hora NO JOGO. Mostra o dia da semana e avisa quando é antes do dia do caso. */
export function GameDateTimeInput({ label, epochDate, value, onChange, error }: Props) {
  const id = useId()
  const parts = value === null ? null : toParts(epochDate, value)

  const update = (date: string, time: string) => {
    if (!date) return onChange(null)
    const minute = fromParts(epochDate, date, time || '00:00')
    if (minute !== null) onChange(minute)
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="type-label mb-1.5 text-muted">{label}</legend>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label={`${label}: data`}
          value={parts?.date ?? ''}
          onChange={(e) => update(e.target.value, parts?.time ?? '00:00')}
          className="h-9 rounded-md border border-border-input bg-bg px-2 font-mono text-sm text-fg"
        />
        <input
          type="time"
          aria-label={`${label}: hora`}
          value={parts?.time ?? ''}
          disabled={!parts}
          onChange={(e) => parts && update(parts.date, e.target.value)}
          className="h-9 rounded-md border border-border-input bg-bg px-2 font-mono text-sm text-fg disabled:opacity-45"
        />
        {parts && <span className="text-sm text-muted">{weekdayName(parts.weekday)}</span>}
        {value !== null && value < 0 && <Chip>antes do caso</Chip>}
        {parts === null && (
          <button type="button" className="text-xs text-subtle underline-offset-4 hover:text-fg hover:underline" onClick={() => onChange(0)}>
            usar o dia do caso
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
