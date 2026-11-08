// Hora NO JOGO: minutos desde 00:00 da data do caso (campaign.epoch_date).
// Tudo em UTC de propósito: o tempo do jogo não tem fuso nem horário de verão.

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const pad = (n: number) => String(n).padStart(2, '0')

export function epochMs(epochDate: string): number {
  const [y, m, d] = epochDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export interface GameTimeParts {
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM'
  weekday: number // 0 = domingo
}

export function toParts(epochDate: string, minute: number): GameTimeParts {
  const t = new Date(epochMs(epochDate) + minute * 60_000)
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
    weekday: t.getUTCDay()
  }
}

/** Data e hora escolhidas na tela -> minutos desde a data do caso. Devolve null se inválido. */
export function fromParts(epochDate: string, date: string, time: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const tm = /^(\d{2}):(\d{2})$/.exec(time || '00:00')
  if (!dm || !tm) return null
  const [y, m, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])]
  const ms = Date.UTC(y, m - 1, d, Number(tm[1]), Number(tm[2]))
  const check = new Date(ms)
  if (check.getUTCDate() !== d || check.getUTCMonth() !== m - 1) return null // 30/02
  return Math.round((ms - epochMs(epochDate)) / 60_000)
}

export function weekdayName(weekday: number, long = false): string {
  return (long ? WEEKDAY_LONG : WEEKDAY_SHORT)[weekday]
}

/** 'qua 22/07 · 23h10' (short) ou 'quarta, 22/07/2026 · 23h10' (long) */
export function formatGameTime(epochDate: string, minute: number, style: 'short' | 'long' = 'short'): string {
  const p = toParts(epochDate, minute)
  const [y, m, d] = p.date.split('-')
  const [hh, mi] = p.time.split(':')
  const hour = `${hh}h${mi}`
  return style === 'long'
    ? `${weekdayName(p.weekday, true)}, ${d}/${m}/${y} · ${hour}`
    : `${weekdayName(p.weekday)} ${d}/${m} · ${hour}`
}

/** 170 -> '2h50', 40 -> '40 min', 1620 -> '1 dia 3h' */
export function formatDuration(minutes: number): string {
  const m = Math.abs(minutes)
  const days = Math.floor(m / 1440)
  const hours = Math.floor((m % 1440) / 60)
  const mins = m % 60
  if (days > 0) return `${days} ${days === 1 ? 'dia' : 'dias'}${hours ? ` ${hours}h` : ''}`
  if (hours > 0) return `${hours}h${mins ? pad(mins) : ''}`
  return `${mins} min`
}
