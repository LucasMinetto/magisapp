// Linha do tempo da investigação: cenas e eventos em ordem de hora no jogo, com as lacunas
// calculadas aqui (e não na tela) para poder testar sem Electron.
import { toParts } from './gameTime'

export interface TimedItem {
  type: 'scene' | 'event'
  id: string
  title: string
  start: number
  end: number | null
}

export type TimelineRow<T extends TimedItem = TimedItem> =
  | { row: 'day'; date: string; weekday: number }
  | { row: 'item'; item: T }
  | { row: 'gap'; from: number; to: number }
  | { row: 'now'; minute: number }

/** Lacuna = trecho sem nada marcado. Abaixo disso é só o tempo de ir de um lugar a outro. */
export const GAP_MINUTES = 60

/** Minuto em que o item deixa de ocupar o tempo (sem fim marcado, conta só o início). */
export const itemEnd = (i: TimedItem) => i.end ?? i.start

export function buildTimeline<T extends TimedItem>(items: T[], epochDate: string, now: number, gapMinutes = GAP_MINUTES): TimelineRow<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || itemEnd(a) - itemEnd(b) || a.title.localeCompare(b.title))
  const rows: TimelineRow<T>[] = []
  let day = ''
  let busyUntil: number | null = null // fim mais tardio até aqui (cenas podem se sobrepor)
  let nowPlaced = false

  const placeNow = () => {
    if (nowPlaced) return
    nowPlaced = true
    pushDay(now)
    rows.push({ row: 'now', minute: now })
  }
  const pushDay = (minute: number) => {
    const p = toParts(epochDate, minute)
    if (p.date !== day) {
      day = p.date
      rows.push({ row: 'day', date: p.date, weekday: p.weekday })
    }
  }

  for (const item of sorted) {
    if (!nowPlaced && now < item.start) {
      // A hora atual cai antes deste item: ela divide a lacuna, se houver.
      if (busyUntil !== null && now - busyUntil >= gapMinutes) rows.push({ row: 'gap', from: busyUntil, to: now })
      if (busyUntil === null || now > busyUntil) busyUntil = now
      placeNow()
    }
    if (busyUntil !== null && item.start - busyUntil >= gapMinutes) {
      pushDay(busyUntil)
      rows.push({ row: 'gap', from: busyUntil, to: item.start })
    }
    pushDay(item.start)
    rows.push({ row: 'item', item })
    busyUntil = busyUntil === null ? itemEnd(item) : Math.max(busyUntil, itemEnd(item))
  }
  placeNow()
  return rows
}

export interface DayCount {
  scenes: number
  events: number
  titles: string[]
}

/** Para o calendário: o que acontece em cada dia ('YYYY-MM-DD'). */
export function countByDay(items: TimedItem[], epochDate: string): Map<string, DayCount> {
  const days = new Map<string, DayCount>()
  for (const i of [...items].sort((a, b) => a.start - b.start)) {
    const date = toParts(epochDate, i.start).date
    const d = days.get(date) ?? { scenes: 0, events: 0, titles: [] }
    if (i.type === 'scene') d.scenes++
    else d.events++
    d.titles.push(i.title)
    days.set(date, d)
  }
  return days
}

/** Semanas do mês (domingo a sábado), com null fora do mês. month: 1–12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: first }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
