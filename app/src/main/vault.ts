// Cofre legível: a campanha inteira em Markdown + .canvas, para abrir no Obsidian se o app não abrir.
// Abre-se a pasta raiz do backup como cofre: `legivel/` tem os textos e `anexos/` as imagens, lado a lado.
// Só escrita: o app nunca lê isto de volta (restaurar é pelo campanha.sqlite ou pelo campanha.json).
import { formatDuration, formatGameTime, weekdayName } from '../shared/gameTime'
import { buildMatcher, findMentions, type Matcher } from '../shared/mentions'
import { buildTimeline, type TimedItem } from '../shared/timeline'
import type { EntityKind, StatValue } from '../shared/types'
import type { CampaignStore } from './store'

export interface VaultFile {
  path: string
  text: string
}

const FOLDER: Record<EntityKind, string> = { personagem: 'Personagens', criatura: 'Criaturas', local: 'Locais', grupo: 'Grupos', lore: 'Lore' }
const KIND: Record<EntityKind, string> = { personagem: 'Personagem', criatura: 'Criatura', local: 'Local', grupo: 'Grupo', lore: 'Lore' }
const ROOT = 'legivel'

/** Nome de arquivo que funciona no Windows e no Obsidian (sem # ^ [ ] | também, que quebram links). */
export const safeFileName = (name: string, fallback: string) =>
  name
    .replace(/[<>:"/\\|?*#^[\]\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 80) || fallback

/** Escolhe nomes únicos dentro de uma pasta: "Nome", "Nome (2)"... */
function namer() {
  const used = new Set<string>()
  return (folder: string, name: string, fallback: string) => {
    const base = safeFileName(name, fallback)
    let n = base
    for (let i = 2; used.has(`${folder}/${n}`.toLowerCase()); i++) n = `${base} (${i})`
    used.add(`${folder}/${n}`.toLowerCase())
    return `${folder}/${n}`
  }
}

const yamlString = (s: string) => JSON.stringify(s) // JSON é YAML válido para strings
function frontmatter(fields: Record<string, string | string[] | boolean | number | null | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${yamlString(x)}`).join('\n')}` : `${k}: ${typeof v === 'string' ? yamlString(v) : v}`))
  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : ''
}

// ------------------------------------------------------------ TipTap JSON -> Markdown

interface PMNode {
  type: string
  text?: string
  attrs?: { level?: number }
  marks?: { type: string }[]
  content?: PMNode[]
}

/** Troca nomes de fichas por [[links]], como o app sublinha no editor. */
function linker(matcher: Matcher, paths: Map<string, string>) {
  return (text: string) => {
    let out = ''
    let at = 0
    for (const m of findMentions(text, matcher)) {
      const path = paths.get(m.id)
      if (!path) continue
      const shown = text.slice(m.from, m.to)
      out += text.slice(at, m.from) + `[[${path}|${shown}]]`
      at = m.to
    }
    return out + text.slice(at)
  }
}

export function docToMarkdown(json: string | null, link: (t: string) => string): string {
  if (!json) return ''
  let doc: PMNode
  try {
    doc = JSON.parse(json) as PMNode
  } catch {
    return ''
  }
  const inline = (nodes: PMNode[] = []) =>
    nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '  \n'
        if (n.type !== 'text' || !n.text) return ''
        let t = link(n.text)
        for (const mk of n.marks ?? []) {
          if (mk.type === 'bold') t = `**${t}**`
          else if (mk.type === 'italic') t = `*${t}*`
          else if (mk.type === 'strike') t = `~~${t}~~`
          else if (mk.type === 'code') t = `\`${t}\``
        }
        return t
      })
      .join('')
  const block = (n: PMNode, indent = ''): string => {
    switch (n.type) {
      case 'paragraph':
        return indent + inline(n.content)
      case 'heading':
        return `${'#'.repeat(Math.min(6, n.attrs?.level ?? 2))} ${inline(n.content)}`
      case 'blockquote':
        return (n.content ?? []).map((c) => block(c)).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n')
      case 'bulletList':
      case 'orderedList':
        return (n.content ?? [])
          .map((li, i) => {
            const mark = n.type === 'bulletList' ? '- ' : `${i + 1}. `
            const [first, ...rest] = (li.content ?? []).map((c) => block(c, `${indent}  `).trimStart())
            return `${indent}${mark}${first ?? ''}${rest.length ? `\n${rest.map((r) => `${indent}  ${r}`).join('\n')}` : ''}`
          })
          .join('\n')
      case 'codeBlock':
        return '```\n' + (n.content ?? []).map((c) => c.text ?? '').join('') + '\n```'
      case 'horizontalRule':
        return '---'
      default:
        return inline(n.content)
    }
  }
  return (doc.content ?? []).map((n) => block(n)).filter((b) => b.trim() !== '').join('\n\n')
}

const statText = (v: StatValue | undefined): string => {
  if (v === undefined || v === '') return ''
  if (Array.isArray(v)) return v.filter(Boolean).join(', ')
  if (typeof v === 'object') return `${v.current}/${v.max}`
  return String(v)
}

// ------------------------------------------------------------ o cofre

export function buildVault(store: CampaignStore): VaultFile[] {
  const files: VaultFile[] = []
  const campaign = store.campaign()
  const when = (m: number | null) => (m === null ? '' : formatGameTime(campaign.epochDate, m, 'long'))
  const name = namer()
  const attachments = new Map<string, string>()
  const img = (id: string | null | undefined) => {
    if (!id) return ''
    if (!attachments.has(id)) attachments.set(id, store.getAttachment(id).relPath)
    return attachments.get(id)!
  }

  // Caminhos primeiro, para os links saírem certos em qualquer ordem.
  const entities = store.listEntities()
  const entityPath = new Map(entities.map((e) => [e.id, name(`${ROOT}/${FOLDER[e.kind]}`, e.name, 'Sem nome')]))
  const scenes = store.listScenes()
  const scenePath = new Map(scenes.map((s, i) => [s.id, name(`${ROOT}/Cenas`, `${String(i + 1).padStart(2, '0')} - ${s.title || 'Sem título'}`, 'Cena')]))
  const clues = store.listClues()
  const cluePath = new Map(clues.map((c) => [c.id, name(`${ROOT}/Pistas`, c.title, 'Sem título')]))
  const sessions = store.listSessions()
  const sessionPath = new Map(sessions.map((s) => [s.id, name(`${ROOT}/Sessões`, `Sessão ${s.number}`, 'Sessão')]))
  const docs = store.listDocuments()
  const docPath = new Map(docs.map((d) => [d.id, name(`${ROOT}/Textos`, d.title, 'Sem título')]))
  const ref = (paths: Map<string, string>, id: string | null | undefined, shown?: string) => {
    const p = id ? paths.get(id) : undefined
    // Mostra só o nome; o caminho completo fica no link (evita ambiguidade entre pastas).
    return p ? `[[${p}|${shown ?? p.slice(p.lastIndexOf('/') + 1)}]]` : ''
  }
  const link = linker(buildMatcher(store.mentionTargets()), entityPath)
  const plain = (t: string) => (t ? link(t) : '')

  // Fichas
  const template = store.templates().find((t) => t.id === campaign.systemTemplateId)
  for (const summary of entities) {
    const e = store.getEntity(summary.id)
    const fields = (template?.fields ?? []).filter((f) => f.entityKind === e.kind).map((f) => [f.label, statText(e.stats[f.key])] as const).filter(([, v]) => v)
    const body = [
      `# ${e.name || 'Sem nome'}`,
      e.role && `*${e.role}*`,
      e.portraitId && `![[${img(e.portraitId)}|200]]`,
      fields.length > 0 && `## Ficha · ${template?.name ?? 'Sistema'}\n\n${fields.map(([l, v]) => `- **${l}:** ${v}`).join('\n')}`,
      e.customAttributes.length > 0 && `## Seus atributos\n\n${e.customAttributes.map((a) => `- **${a.label}:** ${plain(a.value)}`).join('\n')}`,
      e.description && `## Descrição\n\n${plain(e.description)}`,
      e.personality && `## Personalidade e segredos\n\n${plain(e.personality)}`
    ]
    files.push({
      path: `${entityPath.get(e.id)}.md`,
      text: frontmatter({ tipo: KIND[e.kind], papel: e.role, aliases: e.aliases, pj: e.isPlayer || undefined }) + body.filter(Boolean).join('\n\n') + '\n'
    })
  }

  // Cenas
  for (const s of scenes) {
    const full = store.getScene(s.id)
    files.push({
      path: `${scenePath.get(s.id)}.md`,
      text:
        frontmatter({ tipo: 'Cena', inicio: when(s.gameMinuteStart), fim: when(s.gameMinuteEnd), lugar: ref(entityPath, s.locationId), situacao: s.status }) +
        [
          `# ${s.title || 'Sem título'}`,
          full.summary && `> ${plain(full.summary)}`,
          docToMarkdown(full.body, link),
          // O Obsidian abre o PDF já na página com #page=N.
          full.attachments.length > 0 &&
            `## Material\n\n${full.attachments.map((m) => `- ![[${img(m.attachment.id)}${m.pdfPage ? `#page=${m.pdfPage}` : ''}${m.attachment.kind === 'pdf' ? '' : '|200'}]]`).join('\n')}`
        ]
          .filter(Boolean)
          .join('\n\n') +
        '\n'
    })
  }

  // Pistas
  for (const c of clues) {
    files.push({
      path: `${cluePath.get(c.id)}.md`,
      text:
        frontmatter({
          tipo: 'Pista',
          situacao: c.status,
          onde: ref(entityPath, c.locationId),
          cena: ref(scenePath, c.plannedSceneId),
          achada_em: when(c.foundGameMinute),
          sessao: ref(sessionPath, c.foundSessionId),
          quem_achou: c.finders.map((f) => ref(entityPath, f.id)).filter(Boolean)
        }) +
        [
          `# ${c.title || 'Sem título'}`,
          c.image && `![[${img(c.image.id)}]]`,
          c.description && plain(c.description),
          c.reveals && `## O que revela (só o mestre)\n\n${plain(c.reveals)}`
        ]
          .filter(Boolean)
          .join('\n\n') +
        '\n'
    })
  }

  // Sessões
  for (const s of sessions) {
    const full = store.getSession(s.id)
    const found = clues.filter((c) => c.foundSessionId === s.id)
    files.push({
      path: `${sessionPath.get(s.id)}.md`,
      text:
        frontmatter({ tipo: 'Sessão', jogada_em: s.playedOn, inicio_no_jogo: when(full.gameMinuteStart) }) +
        [
          `# Sessão ${s.number}`,
          docToMarkdown(full.notes, link),
          found.length > 0 && `## Pistas achadas\n\n${found.map((c) => `- ${ref(cluePath, c.id)}${c.foundGameMinute !== null ? ` (${when(c.foundGameMinute)})` : ''}`).join('\n')}`
        ]
          .filter(Boolean)
          .join('\n\n') +
        '\n'
    })
  }

  // Textos
  for (const d of docs) {
    const full = store.getDocument(d.id)
    files.push({ path: `${docPath.get(d.id)}.md`, text: [`# ${d.title || 'Sem título'}`, docToMarkdown(full.body, link)].filter(Boolean).join('\n\n') + '\n' })
  }

  // Linha do tempo: cenas e eventos em ordem, com as lacunas marcadas
  const { events } = store.timeline()
  type Item = TimedItem & { line: string; detail: string[] }
  const items: Item[] = [
    ...scenes
      .filter((s) => s.gameMinuteStart !== null)
      .map((s) => ({ type: 'scene' as const, id: s.id, title: s.title, start: s.gameMinuteStart!, end: s.gameMinuteEnd, line: `Cena ${ref(scenePath, s.id)}`, detail: [] })),
    ...events.map((e) => ({
      type: 'event' as const,
      id: e.id,
      title: e.title,
      start: e.gameMinuteStart,
      end: e.gameMinuteEnd,
      line: `Evento **${e.title || 'Sem título'}** (${e.status})${e.locationId ? ` em ${ref(entityPath, e.locationId)}` : ''}`,
      detail: [e.description && plain(e.description), e.ifIgnored && `Se ninguém agir: ${plain(e.ifIgnored)}`].filter(Boolean) as string[]
    }))
  ]
  const hour = (m: number) => formatGameTime(campaign.epochDate, m).split(' · ')[1]
  const lines = buildTimeline(items, campaign.epochDate, campaign.currentGameMinute).map((r) => {
    if (r.row === 'day') return `\n## ${weekdayName(r.weekday, true)}, ${r.date.slice(8)}/${r.date.slice(5, 7)}/${r.date.slice(0, 4)}\n`
    if (r.row === 'now') return `- **${hour(r.minute)} — agora no jogo**`
    if (r.row === 'gap') return `- *lacuna de ${formatDuration(r.to - r.from)}, nada marcado*`
    return [`- ${hour(r.item.start)}${r.item.end !== null && r.item.end !== r.item.start ? `–${hour(r.item.end)}` : ''} · ${r.item.line}`, ...r.item.detail.map((d) => `  - ${d}`)].join('\n')
  })
  files.push({ path: `${ROOT}/Linha do tempo.md`, text: `# Linha do tempo\n${lines.join('\n')}\n` })

  // Quadros: formato JSON Canvas, que o Obsidian abre como canvas
  for (const b of store.listBoards()) {
    const board = store.getBoard(b.id)
    const nodes = board.nodes.map((n) => {
      const base = { id: n.id, x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.w ?? (n.type === 'image' ? 240 : 260)), height: Math.round(n.h ?? (n.type === 'image' ? 180 : 120)) }
      const file =
        n.type === 'entity' ? entityPath.get(n.entityId!) : n.type === 'clue' ? cluePath.get(n.clueId!) : n.type === 'scene' ? scenePath.get(n.sceneId!) : undefined
      if (file) return { ...base, type: 'file', file: `${file}.md` }
      if (n.type === 'image' && n.attachmentId) return { ...base, type: 'file', file: img(n.attachmentId) }
      return { ...base, type: 'text', text: n.type === 'card' || n.type === 'text' ? plain(n.content) : (n.ref?.title ?? '') }
    })
    const edges = board.edges.map((e) => ({ id: e.id, fromNode: e.from, toNode: e.to, toEnd: 'arrow', ...(e.label ? { label: e.label } : {}) }))
    files.push({ path: `${name(`${ROOT}/Quadros`, b.name, 'Quadro')}.canvas`, text: JSON.stringify({ nodes, edges }, null, 2) })
  }

  // Capa da campanha
  const counts = store.counts()
  files.push({
    path: `${ROOT}/${safeFileName(campaign.name, 'Campanha')}.md`,
    text:
      frontmatter({ tipo: 'Campanha', data_do_caso: when(0).split(' · ')[0], agora_no_jogo: when(campaign.currentGameMinute) }) +
      [
        `# ${campaign.name}`,
        campaign.tagline && `*${campaign.tagline}*`,
        campaign.coverId && `![[${img(campaign.coverId)}|300]]`,
        `${counts.entities} fichas · ${counts.scenes} cenas · ${counts.clues} pistas · ${counts.sessions} sessões`,
        `- [[${ROOT}/Linha do tempo|Linha do tempo]]`
      ]
        .filter(Boolean)
        .join('\n\n') +
      '\n'
  })
  return files
}

export const README = `# Backup do Mesa

Este arquivo é um zip comum. Para abrir sem o app:

- **No Obsidian:** abra esta pasta inteira como cofre ("Abrir pasta como cofre"). Os textos estão em \`legivel/\` e as imagens em \`anexos/\`; links entre fichas, cenas e pistas funcionam, e os quadros abrem como canvas.
- **Banco completo:** \`campanha.sqlite\` abre no DB Browser for SQLite.
- **Dados em texto:** \`campanha.json\` tem tudo, tabela por tabela.

Para voltar ao app: Ajustes → Restaurar um backup (ou "Restaurar backup…" na tela de campanhas). A campanha restaurada vira uma pasta nova; nada é sobrescrito.
`
