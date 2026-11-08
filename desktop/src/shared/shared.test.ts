import { describe, expect, it } from 'vitest'
import { formatDuration, formatGameTime, fromParts, toParts } from './gameTime'
import { buildMatcher, docText, findMentions } from './mentions'
import { buildTimeline, countByDay, monthGrid, type TimedItem } from './timeline'

const CASE = '2026-07-22' // quarta-feira

describe('hora no jogo', () => {
  it('mostra a data do caso com o dia da semana', () => {
    expect(formatGameTime(CASE, 23 * 60 + 10)).toBe('qua 22/07 · 23h10')
    expect(formatGameTime(CASE, 23 * 60 + 10, 'long')).toBe('quarta, 22/07/2026 · 23h10')
  })
  it('passa da meia-noite para o dia seguinte', () => {
    expect(formatGameTime(CASE, 23 * 60 + 50 + 20)).toBe('qui 23/07 · 00h10')
  })
  it('aceita tempo antes do chamado', () => {
    const crime = fromParts(CASE, '2026-07-19', '22:00')
    expect(crime).toBe(-3 * 1440 + 22 * 60)
    expect(toParts(CASE, crime!).weekday).toBe(0) // domingo
  })
  it('recusa data que não existe', () => {
    expect(fromParts(CASE, '2026-02-30', '10:00')).toBeNull()
    expect(fromParts(CASE, '22/07/2026', '10:00')).toBeNull()
  })
  it('ida e volta', () => {
    for (const m of [-5000, -1, 0, 59, 1439, 1440, 100_000]) {
      const p = toParts(CASE, m)
      expect(fromParts(CASE, p.date, p.time)).toBe(m)
    }
  })
  it('durações', () => {
    expect(formatDuration(170)).toBe('2h50')
    expect(formatDuration(40)).toBe('40 min')
    expect(formatDuration(1620)).toBe('1 dia 3h')
  })
})

describe('menções', () => {
  const matcher = buildMatcher([
    { id: 'joao', name: 'João', aliases: [] },
    { id: 'joaos', name: 'João Silva', aliases: ['Joãozinho'] },
    { id: 'ana', name: 'Ana', aliases: [] },
    { id: 'aurelio', name: 'Dr. Aurélio', aliases: ['Aurélio', 'o diretor'] }
  ])
  const ids = (text: string) => findMentions(text, matcher).map((m) => m.id)

  it('ignora acento e caixa', () => {
    expect(ids('falei com o joao ontem')).toEqual(['joao'])
  })
  it('respeita limite de palavra', () => {
    expect(ids('comeu banana e Ana viu')).toEqual(['ana'])
  })
  it('prefere o nome mais longo', () => {
    expect(ids('João Silva e João')).toEqual(['joaos', 'joao'])
  })
  it('acha apelidos e devolve a posição no texto original', () => {
    const text = 'Então o diretor sorriu. AURELIO saiu.'
    const found = findMentions(text, matcher)
    expect(found.map((m) => text.slice(m.from, m.to))).toEqual(['o diretor', 'AURELIO'])
  })
  it('não casa dentro de outra palavra', () => {
    expect(ids('Joãozinhos')).toEqual([])
  })
  it('extrai texto de um documento TipTap', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Ala fechada' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Dr. Aurélio ' }, { type: 'text', text: 'espera.', marks: [{ type: 'bold' }] }] }
      ]
    })
    expect(docText(doc)).toBe('Ala fechada\nDr. Aurélio espera.')
  })
})

describe('linha do tempo', () => {
  const h = (hh: number, mm = 0) => hh * 60 + mm
  const items: TimedItem[] = [
    { type: 'scene', id: 'a', title: 'Chamado', start: h(19), end: h(20) },
    { type: 'scene', id: 'b', title: 'Ala', start: h(23, 10), end: h(23, 59) },
    { type: 'event', id: 'c', title: 'Vigia', start: h(24), end: null },
    { type: 'event', id: 'd', title: 'Livro', start: h(26, 30), end: null }
  ]
  const kinds = (rows: ReturnType<typeof buildTimeline>) =>
    rows.map((r) => (r.row === 'item' ? r.item.id : r.row === 'gap' ? `gap ${r.to - r.from}` : r.row === 'day' ? r.date.slice(8) : 'now'))

  it('marca as lacunas de uma hora ou mais e separa os dias', () => {
    expect(kinds(buildTimeline(items, CASE, h(19, 30)))).toEqual(['22', 'a', 'now', 'gap 190', 'b', '23', 'c', 'gap 150', 'd'])
  })
  it('a hora atual divide a lacuna em que cai', () => {
    expect(kinds(buildTimeline(items, CASE, h(21)))).toEqual(['22', 'a', 'gap 60', 'now', 'gap 130', 'b', '23', 'c', 'gap 150', 'd'])
  })
  it('sem nada marcado, só a hora atual', () => {
    expect(kinds(buildTimeline([], CASE, 0))).toEqual(['22', 'now'])
  })
  it('cenas sobrepostas não abrem lacuna falsa', () => {
    const overlap: TimedItem[] = [
      { type: 'scene', id: 'x', title: 'Longa', start: h(10), end: h(18) },
      { type: 'scene', id: 'y', title: 'Curta', start: h(11), end: h(12) },
      { type: 'scene', id: 'z', title: 'Depois', start: h(18, 30), end: null }
    ]
    expect(kinds(buildTimeline(overlap, CASE, h(30)))).toEqual(['22', 'x', 'y', 'z', '23', 'now'])
  })
  it('conta por dia e monta o mês de domingo a sábado', () => {
    expect(countByDay(items, CASE).get('2026-07-23')).toEqual({ scenes: 0, events: 2, titles: ['Vigia', 'Livro'] })
    const july = monthGrid(2026, 7)
    expect(july[0]).toEqual([null, null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'])
    expect(july.flat().filter(Boolean)).toHaveLength(31)
  })
})
