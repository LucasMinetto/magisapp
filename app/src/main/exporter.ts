// Exportar a campanha para ler, imprimir ou mandar: PDF, Word (.docx), texto (.txt).
// Um modelo só (blocos) e um renderizador por formato. A pasta Markdown/Obsidian usa o vault.ts.
// Sem Electron aqui (o PDF é feito no ipc, imprimindo o HTML numa janela escondida).
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, TextRun, type ParagraphChild } from 'docx'
import { existsSync, readFileSync } from 'node:fs'
import { formatDuration, formatGameTime, weekdayName } from '../shared/gameTime'
import { buildTimeline, type TimedItem } from '../shared/timeline'
import { EXPORT_SECTIONS, type EntityKind, type ExportOptions, type StatValue } from '../shared/types'
import { linhaDaRolagem, linhasDaIniciativa, secoesDaAmeaca, secoesDoAgente, type SecaoFicha } from '../shared/ordem/textoFicha'
import type { CampaignStore } from './store'
import { safeFileName } from './vault'

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
}

export type Block =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'h1' | 'h2' | 'h3'; text: string }
  | { t: 'p'; runs: Run[] }
  | { t: 'list'; items: Run[][] }
  | { t: 'quote'; runs: Run[] }
  | { t: 'meta'; pairs: [string, string][] }
  | { t: 'image'; file: string; alt: string }
  | { t: 'gm'; label: string; runs: Run[] } // só o mestre vê; some na versão dos jogadores
  | { t: 'break' }

const KIND_PLURAL: Record<EntityKind, string> = { personagem: 'Personagens', ameaca: 'Ameaças', local: 'Locais', grupo: 'Grupos', lore: 'Lore' }
const STATUS: Record<string, string> = {
  planejada: 'planejada',
  jogada: 'jogada',
  pulada: 'pulada',
  planejado: 'planejado',
  aconteceu: 'aconteceu',
  evitado: 'evitado',
  oculta: 'oculta',
  achada: 'achada',
  entendida: 'entendida'
}

const plain = (text: string): Run[] => (text ? [{ text }] : [])
const paras = (text: string): Block[] =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ t: 'p', runs: plain(p) }))

const statText = (v: StatValue | undefined): string => {
  if (v === undefined || v === '') return ''
  if (Array.isArray(v)) return v.filter(Boolean).join(', ')
  if (typeof v === 'object') return v.max || v.current ? `${v.current}/${v.max}` : ''
  return String(v)
}

// ------------------------------------------------------------ texto do editor -> blocos

interface PMNode {
  type: string
  text?: string
  attrs?: { level?: number }
  marks?: { type: string }[]
  content?: PMNode[]
}

export function docToBlocks(json: string | null): Block[] {
  if (!json) return []
  let doc: PMNode
  try {
    doc = JSON.parse(json) as PMNode
  } catch {
    return []
  }
  const runs = (nodes: PMNode[] = []): Run[] =>
    nodes.flatMap((n) => {
      if (n.type === 'hardBreak') return [{ text: '\n' }]
      if (n.type !== 'text' || !n.text) return []
      const m = new Set((n.marks ?? []).map((x) => x.type))
      return [{ text: n.text, bold: m.has('bold') || undefined, italic: m.has('italic') || undefined, strike: m.has('strike') || undefined }]
    })
  const flat = (n: PMNode): Run[] => (n.type === 'text' || n.type === 'hardBreak' ? runs([n]) : (n.content ?? []).flatMap((c) => [...flat(c)]))
  const out: Block[] = []
  for (const n of doc.content ?? []) {
    if (n.type === 'paragraph') {
      const r = runs(n.content)
      if (r.length) out.push({ t: 'p', runs: r })
    } else if (n.type === 'heading') out.push({ t: 'h3', text: runs(n.content).map((r) => r.text).join('') })
    else if (n.type === 'bulletList' || n.type === 'orderedList') out.push({ t: 'list', items: (n.content ?? []).map((li) => flat(li)) })
    else if (n.type === 'blockquote') out.push({ t: 'quote', runs: (n.content ?? []).flatMap((c, i) => [...(i ? [{ text: '\n' }] : []), ...flat(c)]) })
    else {
      const r = flat(n)
      if (r.length) out.push({ t: 'p', runs: r })
    }
  }
  return out
}

// ------------------------------------------------------------ campanha -> blocos

/** Seções da ficha completa ou do bloco de ameaça em blocos: título em negrito, pares, lista e parágrafos. */
const secoesEmBlocos = (secoes: SecaoFicha[]): Block[] =>
  secoes.flatMap((s) => [
    { t: 'p', runs: [{ text: s.titulo, bold: true }] } as Block,
    ...(s.pares?.length ? [{ t: 'meta', pairs: s.pares } as Block] : []),
    ...(s.itens?.length ? [{ t: 'list', items: s.itens.map((i) => plain(i)) } as Block] : []),
    ...(s.texto ?? []).flatMap(paras)
  ])

export function buildExport(store: CampaignStore, opts: ExportOptions): Block[] {
  const c = store.campaign()
  const when = (m: number | null) => (m === null ? '' : formatGameTime(c.epochDate, m, 'long'))
  const want = new Set(opts.sections)
  const file = (id: string | null | undefined) => {
    if (!id) return null
    const f = store.attachmentFile(id)
    return f && existsSync(f.file) ? f.file : null
  }
  const gm = (label: string, text: string): Block[] => (opts.gmOnly && text ? [{ t: 'gm', label, runs: plain(text) }] : [])
  const out: Block[] = []
  const counts = store.counts()
  out.push({ t: 'title', text: c.name, sub: c.tagline ?? undefined })
  const cover = file(c.coverId)
  if (cover) out.push({ t: 'image', file: cover, alt: `Capa de ${c.name}` })
  out.push({
    t: 'meta',
    pairs: [
      ['Data do caso', when(0).split(' · ')[0]],
      ['Agora no jogo', when(c.currentGameMinute)],
      ['Conteúdo', `${counts.entities} fichas · ${counts.scenes} cenas · ${counts.clues} pistas · ${counts.sessions} sessões`],
      ...(opts.gmOnly ? [] : ([['Versão', 'para os jogadores (sem o que só o mestre vê)']] as [string, string][]))
    ]
  })

  const section = (title: string, blocks: Block[]) => {
    if (!blocks.length) return
    out.push({ t: 'break' }, { t: 'h1', text: title }, ...blocks)
  }

  if (want.has('linha-do-tempo')) {
    const { scenes, events } = store.timeline()
    const items: (TimedItem & { label: string; extra: string[] })[] = [
      ...scenes.filter((s) => s.gameMinuteStart !== null).map((s) => ({ type: 'scene' as const, id: s.id, title: s.title, start: s.gameMinuteStart!, end: s.gameMinuteEnd, label: `Cena: ${s.title || 'Sem título'}${s.locationName ? ` (${s.locationName})` : ''}`, extra: [] })),
      ...events
        .filter((e) => opts.gmOnly || e.status === 'aconteceu')
        .map((e) => ({
          type: 'event' as const,
          id: e.id,
          title: e.title,
          start: e.gameMinuteStart,
          end: e.gameMinuteEnd,
          label: `Evento: ${e.title || 'Sem título'} (${STATUS[e.status]})`,
          extra: opts.gmOnly && e.ifIgnored ? [`Se ninguém agir: ${e.ifIgnored}`] : []
        }))
    ]
    const hour = (m: number) => formatGameTime(c.epochDate, m).split(' · ')[1]
    const blocks: Block[] = []
    let list: Run[][] = []
    const flush = () => {
      if (list.length) blocks.push({ t: 'list', items: list })
      list = []
    }
    for (const r of buildTimeline(items, c.epochDate, c.currentGameMinute)) {
      if (r.row === 'day') {
        flush()
        blocks.push({ t: 'h3', text: `${weekdayName(r.weekday, true)}, ${r.date.slice(8)}/${r.date.slice(5, 7)}/${r.date.slice(0, 4)}` })
      } else if (r.row === 'now') list.push([{ text: `${hour(r.minute)} · agora no jogo`, bold: true }])
      else if (r.row === 'gap') list.push([{ text: `lacuna de ${formatDuration(r.to - r.from)}, nada marcado`, italic: true }])
      else list.push([{ text: `${hour(r.item.start)}${r.item.end !== null && r.item.end !== r.item.start ? `–${hour(r.item.end)}` : ''}  `, bold: true }, { text: r.item.label }, ...r.item.extra.map((x) => ({ text: ` — ${x}`, italic: true }))])
    }
    flush()
    section('Linha do tempo', blocks)
  }

  if (want.has('cenas')) {
    const blocks: Block[] = []
    for (const s of store.listScenes()) {
      const full = store.getScene(s.id)
      blocks.push({ t: 'h2', text: s.title || 'Sem título' })
      blocks.push({
        t: 'meta',
        pairs: [
          ['Quando', [when(s.gameMinuteStart), s.gameMinuteEnd !== null ? `até ${when(s.gameMinuteEnd).split(' · ')[1]}` : ''].filter(Boolean).join(' ') || 'sem hora'],
          ['Onde', s.locationName ?? '—'],
          ['Situação', STATUS[s.status]]
        ]
      })
      if (full.summary) blocks.push({ t: 'quote', runs: plain(full.summary) })
      blocks.push(...docToBlocks(full.body))
      if (full.attachments.length)
        blocks.push({ t: 'meta', pairs: [['Material', full.attachments.map((m) => `${m.attachment.fileName}${m.pdfPage ? ` (p. ${m.pdfPage})` : ''}`).join(' · ')]] })
    }
    section('Cenas', blocks)
  }

  if (want.has('fichas')) {
    const template = store.templates().find((t) => t.id === c.systemTemplateId)
    const blocks: Block[] = []
    for (const kind of Object.keys(KIND_PLURAL) as EntityKind[]) {
      const list = store.listEntities(kind)
      if (!list.length) continue
      blocks.push({ t: 'h2', text: KIND_PLURAL[kind] })
      for (const summary of list) {
        const e = store.getEntity(summary.id)
        blocks.push({ t: 'h3', text: `${e.name || 'Sem nome'}${e.isPlayer ? ' (PJ)' : ''}` })
        if (e.role) blocks.push({ t: 'p', runs: [{ text: e.role, italic: true }] })
        const portrait = file(e.portraitId)
        if (portrait) blocks.push({ t: 'image', file: portrait, alt: e.name })
        // Ficha completa e bloco de ameaça no lugar dos campos do modelo. Na versão dos jogadores só sai a ficha
        // dos agentes deles: bloco de ameaça e ficha de vilão são do mestre.
        const sheet = e.sheetData
        const showSheet = sheet && (opts.gmOnly || e.isPlayer)
        if (showSheet) blocks.push(...secoesEmBlocos('acoes' in sheet ? secoesDaAmeaca(sheet) : secoesDoAgente(sheet)))
        const stats = (sheet ? [] : (template?.fields ?? []).filter((f) => f.entityKind === kind)).map((f) => [f.label, statText(e.stats[f.key])] as [string, string]).filter(([, v]) => v)
        const custom = e.customAttributes.map((a) => [a.label, a.value] as [string, string])
        if (stats.length + custom.length) blocks.push({ t: 'meta', pairs: [...stats, ...custom] })
        blocks.push(...paras(e.description), ...gm('Personalidade e segredos', e.personality))
      }
    }
    section('Fichas', blocks)
  }

  if (want.has('pistas')) {
    const blocks: Block[] = []
    for (const clue of store.listClues().filter((x) => opts.gmOnly || x.status !== 'oculta')) {
      blocks.push({ t: 'h2', text: clue.title || 'Sem título' })
      const img = file(clue.image?.id)
      if (img) blocks.push({ t: 'image', file: img, alt: clue.title })
      blocks.push({
        t: 'meta',
        pairs: [
          ['Situação', STATUS[clue.status]],
          ['Onde', clue.locationName ?? '—'],
          ...(clue.status !== 'oculta'
            ? ([
                ['Achada', [when(clue.foundGameMinute), clue.foundSessionNumber !== null ? `sessão ${clue.foundSessionNumber}` : ''].filter(Boolean).join(' · ') || '—'],
                ['Quem achou', clue.finders.map((f) => f.name).join(', ') || '—']
              ] as [string, string][])
            : [])
        ]
      })
      blocks.push(...paras(clue.description), ...gm('O que revela', clue.reveals))
    }
    section('Pistas', blocks)
  }

  if (want.has('sessoes')) {
    const blocks: Block[] = []
    const clues = store.listClues()
    const players = new Set(store.listEntities('personagem').filter((e) => e.isPlayer).map((e) => e.id))
    for (const s of store.listSessions()) {
      const full = store.getSession(s.id)
      blocks.push({ t: 'h2', text: `Sessão ${s.number}` })
      blocks.push({
        t: 'meta',
        pairs: [
          ['Jogada em', s.playedOn ? `${s.playedOn.slice(8)}/${s.playedOn.slice(5, 7)}/${s.playedOn.slice(0, 4)}` : '—'],
          ['Começou no jogo', when(full.gameMinuteStart) || '—']
        ]
      })
      blocks.push(...docToBlocks(full.notes))
      const ini = store.getInitiative(s.id)
      if (opts.gmOnly && ini.ordem.length) blocks.push({ t: 'h3', text: `Combate (rodada ${ini.rodada})` }, { t: 'list', items: linhasDaIniciativa(ini).map((l) => plain(l)) })
      // Na versão dos jogadores, só as rolagens dos agentes deles.
      const rolls = store.listRolls({ sessionId: s.id, limit: 5000 }).reverse().filter((r) => opts.gmOnly || (r.entityId !== null && players.has(r.entityId)))
      if (rolls.length) blocks.push({ t: 'h3', text: 'Rolagens' }, { t: 'list', items: rolls.map((r) => plain(`${r.gameMinute !== null ? `${when(r.gameMinute).split(' · ')[1]} · ` : ''}${linhaDaRolagem(r)}`)) })
      const found = clues.filter((x) => x.foundSessionId === s.id)
      if (found.length) blocks.push({ t: 'h3', text: 'Pistas achadas' }, { t: 'list', items: found.map((x) => plain(x.title || 'Sem título')) })
    }
    section('Sessões', blocks)
  }

  if (want.has('textos')) {
    const blocks: Block[] = []
    for (const d of store.listDocuments()) {
      blocks.push({ t: 'h2', text: d.title || 'Sem título' }, ...docToBlocks(store.getDocument(d.id).body))
    }
    section('Textos', blocks)
  }
  return out
}

// ------------------------------------------------------------ .txt

const runsText = (r: Run[]) => r.map((x) => x.text).join('')

export function toText(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    if (b.t === 'title') out.push(b.text.toUpperCase(), ...(b.sub ? [b.sub] : []), '')
    else if (b.t === 'h1') out.push('', b.text.toUpperCase(), '='.repeat(Math.min(60, b.text.length)), '')
    else if (b.t === 'h2') out.push('', b.text, '-'.repeat(Math.min(60, b.text.length)))
    else if (b.t === 'h3') out.push('', b.text)
    else if (b.t === 'p') out.push(runsText(b.runs), '')
    else if (b.t === 'quote') out.push(`> ${runsText(b.runs)}`, '')
    else if (b.t === 'list') out.push(...b.items.map((i) => `- ${runsText(i)}`), '')
    else if (b.t === 'meta') out.push(...b.pairs.map(([k, v]) => `${k}: ${v}`), '')
    else if (b.t === 'gm') out.push(`[${b.label}] ${runsText(b.runs)}`, '')
    else if (b.t === 'image') out.push(`[imagem: ${b.alt}]`, '')
  }
  return out.join('\r\n').replace(/(\r\n){3,}/g, '\r\n\r\n').trim() + '\r\n'
}

// ------------------------------------------------------------ HTML (para o PDF)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const runsHtml = (r: Run[]) =>
  r
    .map((x) => {
      let h = esc(x.text).replace(/\n/g, '<br>')
      if (x.bold) h = `<strong>${h}</strong>`
      if (x.italic) h = `<em>${h}</em>`
      if (x.strike) h = `<s>${h}</s>`
      return h
    })
    .join('')

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }
const dataUrl = (file: string) => {
  const ext = file.split('.').pop()!.toLowerCase()
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`
}

/** Página para imprimir: serif para ler, preto no branco, uma seção por página. */
export function toHtml(blocks: Block[], title: string): string {
  const body = blocks
    .map((b) => {
      switch (b.t) {
        case 'title':
          return `<header><h1 class="title">${esc(b.text)}</h1>${b.sub ? `<p class="sub">${esc(b.sub)}</p>` : ''}</header>`
        case 'h1':
          return `<h1>${esc(b.text)}</h1>`
        case 'h2':
          return `<h2>${esc(b.text)}</h2>`
        case 'h3':
          return `<h3>${esc(b.text)}</h3>`
        case 'p':
          return `<p>${runsHtml(b.runs)}</p>`
        case 'quote':
          return `<blockquote>${runsHtml(b.runs)}</blockquote>`
        case 'list':
          return `<ul>${b.items.map((i) => `<li>${runsHtml(i)}</li>`).join('')}</ul>`
        case 'meta':
          return `<dl>${b.pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
        case 'gm':
          return `<aside class="gm"><span>${esc(b.label)} · só o mestre</span>${runsHtml(b.runs)}</aside>`
        case 'image':
          return `<figure><img src="${dataUrl(b.file)}" alt="${esc(b.alt)}"></figure>`
        case 'break':
          return '<div class="break"></div>'
      }
    })
    .join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: A4; margin: 18mm 18mm 20mm; }
body { font: 11pt/1.5 Georgia, 'Times New Roman', serif; color: #111; }
header { margin-top: 30mm; }
.title { font-size: 28pt; margin: 0 0 4mm; }
.sub { font-style: italic; color: #444; font-size: 13pt; }
h1 { font: 700 18pt/1.2 Arial, sans-serif; border-bottom: 1px solid #999; padding-bottom: 2mm; }
h2 { font: 700 13pt/1.3 Arial, sans-serif; margin: 7mm 0 2mm; break-after: avoid; }
h3 { font: 700 11pt/1.3 Arial, sans-serif; margin: 5mm 0 1mm; break-after: avoid; }
p { margin: 0 0 2.5mm; }
blockquote { margin: 0 0 3mm; padding-left: 4mm; border-left: 2px solid #999; color: #333; }
ul { margin: 0 0 3mm; padding-left: 6mm; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5mm 4mm; font: 9.5pt/1.4 Arial, sans-serif; margin: 0 0 3mm; }
dt { font-weight: 700; color: #333; }
dd { margin: 0; }
figure { margin: 2mm 0 4mm; }
img { max-width: 70mm; max-height: 70mm; border: 1px solid #ccc; }
.gm { display: block; margin: 0 0 3mm; padding: 2mm 3mm; background: #f1f1f1; border-left: 3px solid #555; }
.gm span { display: block; font: 700 8.5pt Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #555; }
.break { break-after: page; }
</style></head><body>${body}</body></html>`
}

// ------------------------------------------------------------ .docx

/** Largura e altura de PNG, JPEG e GIF lendo o cabeçalho (o Word precisa do tamanho). */
export function imageSize(buf: Buffer): { type: 'png' | 'jpg' | 'gif'; width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { type: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      i += 2 + len
    }
  }
  return null
}

const docRuns = (r: Run[]): ParagraphChild[] =>
  r.flatMap((x) => x.text.split('\n').map((line, i) => new TextRun({ text: line, bold: x.bold, italics: x.italic, strike: x.strike, break: i > 0 ? 1 : undefined })))

export async function toDocx(blocks: Block[], title: string): Promise<Buffer> {
  const children: Paragraph[] = []
  for (const b of blocks) {
    if (b.t === 'title') {
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { before: 2400 }, children: [new TextRun(b.text)] }))
      if (b.sub) children.push(new Paragraph({ children: [new TextRun({ text: b.sub, italics: true })] }))
    } else if (b.t === 'h1') children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(b.text)] }))
    else if (b.t === 'h2') children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.text)] }))
    else if (b.t === 'h3') children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.text)] }))
    else if (b.t === 'p') children.push(new Paragraph({ children: docRuns(b.runs) }))
    else if (b.t === 'quote') children.push(new Paragraph({ indent: { left: 400 }, children: docRuns(b.runs.map((r) => ({ ...r, italic: true }))) }))
    else if (b.t === 'list') for (const item of b.items) children.push(new Paragraph({ bullet: { level: 0 }, children: docRuns(item) }))
    else if (b.t === 'meta') for (const [k, v] of b.pairs) children.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(v)] }))
    else if (b.t === 'gm')
      children.push(
        new Paragraph({
          shading: { type: 'clear', fill: 'EEEEEE', color: 'auto' },
          indent: { left: 200 },
          children: [new TextRun({ text: `${b.label} (só o mestre): `, bold: true }), ...docRuns(b.runs)]
        })
      )
    else if (b.t === 'image') {
      const buf = readFileSync(b.file)
      const size = imageSize(buf)
      if (!size || !size.width || !size.height) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[imagem: ${b.alt}]`, italics: true })] }))
        continue
      }
      const scale = Math.min(1, 260 / size.width, 260 / size.height)
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new ImageRun({ type: size.type, data: buf, transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) }, altText: { name: b.alt, description: b.alt, title: b.alt } })]
        })
      )
    } else if (b.t === 'break') children.push(new Paragraph({ children: [new PageBreak()] }))
  }
  const doc = new Document({ title, creator: 'Magistrado', styles: { default: { document: { run: { font: 'Georgia', size: 22 } } } }, sections: [{ children }] })
  return Packer.toBuffer(doc)
}

export const ALL_SECTIONS = [...EXPORT_SECTIONS]
export const exportFileName = (campaignName: string, ext: string) => `${safeFileName(campaignName, 'Campanha')}.${ext}`
