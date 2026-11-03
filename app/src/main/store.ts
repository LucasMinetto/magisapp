import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { DB } from './db'
import { newId, nowIso } from './db'
import { buildMatcher, docText, findMentions, fold, type Matcher } from '../shared/mentions'
import type {
  Attachment,
  AttachmentDetail,
  AttachmentUse,
  Board,
  ImportResult,
  SceneAttachment,
  SceneNote,
  BoardNode,
  BoardSave,
  BoardSummary,
  Campaign,
  Clue,
  ClueInput,
  CampaignUpdate,
  CustomAttribute,
  DocumentInput,
  DocumentSummary,
  TextDocument,
  TrashItem,
  TrashType,
  CampaignCounts,
  Entity,
  EntityDetail,
  EntityInput,
  EntityKind,
  EntitySummary,
  GameSession,
  GameSessionDetail,
  MentionRef,
  MentionTargetDTO,
  Scene,
  SceneInput,
  SceneSummary,
  SearchRefType,
  SearchResult,
  SystemTemplate,
  TemplateField,
  TimelineData,
  TimelineEvent,
  TimelineEventInput
} from '../shared/types'

interface EntityRow {
  id: string
  kind: EntityKind
  is_player: number
  name: string
  role: string
  aliases: string
  system_template_id: string | null
  stats: string
  description: string
  personality: string
  portrait_id: string | null
  map_id: string | null
  notes: string | null
  custom_attributes: string
  updated_at: string
}

interface SceneRow {
  id: string
  title: string
  summary: string
  body: string | null
  sort: number
  status: SceneSummary['status']
  location_id: string | null
  location_name: string | null
  game_minute_start: number | null
  game_minute_end: number | null
}

interface EventRow {
  id: string
  title: string
  description: string
  if_ignored: string
  status: TimelineEvent['status']
  game_minute_start: number
  game_minute_end: number | null
  scene_id: string | null
  location_id: string | null
  location_name: string | null
}

interface AttachmentRow {
  id: string
  kind: Attachment['kind']
  file_name: string
  rel_path: string
  mime: string
  size_bytes: number
}

interface ClueRow {
  id: string
  title: string
  description: string
  reveals: string
  status: Clue['status']
  image_id: string | null
  planned_scene_id: string | null
  planned_scene_title: string | null
  location_id: string | null
  location_name: string | null
  found_game_minute: number | null
  found_session_id: string | null
  found_session_number: number | null
}

const PDF_MIME: Record<string, string> = { '.pdf': 'application/pdf' }
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
}
export const IMAGE_EXTENSIONS = Object.keys(IMAGE_MIME).map((e) => e.slice(1))
export const IMPORT_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf']

/** Palpite pelo nome: "token-cultista.png" é token, "mapa do porão.jpg" é mapa. Dá para trocar depois. */
const guessKind = (fileName: string, mime: string): Attachment['kind'] => {
  if (mime === 'application/pdf') return 'pdf'
  const n = fold(fileName)
  if (/\btokens?\b/.test(n)) return 'token'
  if (/\b(mapa|mapas|map|maps|planta)\b/.test(n)) return 'mapa'
  return 'imagem'
}
const MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024

const attachment = (r: AttachmentRow): Attachment => ({
  id: r.id,
  kind: r.kind,
  fileName: r.file_name,
  relPath: r.rel_path,
  mime: r.mime,
  sizeBytes: r.size_bytes,
  url: `magistrado://anexo/${r.id}`
})

/** 'Bilhete Rasgado (1).PNG' -> 'bilhete-rasgado-1' */
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'anexo'

const parseJson = <T>(text: string | null, fallback: T): T => {
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

const summary = (r: EntityRow): EntitySummary => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  role: r.role,
  isPlayer: r.is_player === 1,
  portraitUrl: r.portrait_id ? `magistrado://anexo/${r.portrait_id}` : null,
  updatedAt: r.updated_at
})

const entity = (r: EntityRow): Entity => ({
  ...summary(r),
  portraitId: r.portrait_id,
  mapId: r.map_id,
  mapUrl: r.map_id ? `magistrado://anexo/${r.map_id}` : null,
  notes: r.notes,
  customAttributes: parseJson<CustomAttribute[]>(r.custom_attributes, []),
  aliases: parseJson<string[]>(r.aliases, []),
  systemTemplateId: r.system_template_id,
  stats: parseJson(r.stats, {}),
  description: r.description,
  personality: r.personality
})

const sceneSummary = (r: SceneRow): SceneSummary => ({
  id: r.id,
  title: r.title,
  status: r.status,
  sort: r.sort,
  locationId: r.location_id,
  locationName: r.location_name,
  gameMinuteStart: r.game_minute_start,
  gameMinuteEnd: r.game_minute_end,
  summaryText: r.summary
})

/** Tudo o que se faz numa campanha aberta. Um só escritor: o processo principal. */
export class CampaignStore {
  private matcher: Matcher | null = null

  constructor(
    readonly db: DB,
    readonly path: string
  ) {}

  close(): void {
    this.db.close()
  }

  // ------------------------------------------------------------ campanha

  campaign(): Campaign {
    const r = this.db
      .prepare('select id, name, epoch_date, current_game_minute, tagline, cover_id, system_template_id from campaign')
      .get() as {
      id: string
      name: string
      epoch_date: string
      current_game_minute: number
      tagline: string | null
      cover_id: string | null
      system_template_id: string | null
    }
    return {
      id: r.id,
      name: r.name,
      epochDate: r.epoch_date,
      currentGameMinute: r.current_game_minute,
      tagline: r.tagline,
      coverId: r.cover_id,
      coverUrl: r.cover_id ? `magistrado://anexo/${r.cover_id}` : null,
      systemTemplateId: r.system_template_id,
      path: this.path
    }
  }

  updateCampaign(input: CampaignUpdate): Campaign {
    this.db.prepare('update campaign set name = ?, tagline = ?, cover_id = ?, updated_at = ?').run(input.name, input.tagline.trim() || null, input.coverId, nowIso())
    return this.campaign()
  }

  setClock(minute: number): Campaign {
    this.db.prepare('update campaign set current_game_minute = ?, updated_at = ?').run(minute, nowIso())
    return this.campaign()
  }

  advanceClock(minutes: number): Campaign {
    return this.setClock(this.campaign().currentGameMinute + minutes)
  }

  counts(): CampaignCounts {
    const n = (sql: string) => (this.db.prepare(sql).get() as { n: number }).n
    return {
      entities: n('select count(*) n from entities where deleted_at is null'),
      scenes: n('select count(*) n from scenes where deleted_at is null'),
      clues: n('select count(*) n from clues where deleted_at is null'),
      sessions: n('select count(*) n from game_sessions where deleted_at is null')
    }
  }

  templates(): SystemTemplate[] {
    const templates = this.db.prepare('select id, name from system_templates order by name').all() as { id: string; name: string }[]
    const fields = this.db
      .prepare('select id, template_id, entity_kind, key, label, type, group_name, options, sort from template_fields order by sort')
      .all() as { id: string; template_id: string; entity_kind: EntityKind; key: string; label: string; type: TemplateField['type']; group_name: string; options: string; sort: number }[]
    return templates.map((t) => ({
      ...t,
      fields: fields
        .filter((f) => f.template_id === t.id)
        .map((f) => ({ id: f.id, entityKind: f.entity_kind, key: f.key, label: f.label, type: f.type, groupName: f.group_name, options: parseJson(f.options, {}), sort: f.sort }))
    }))
  }

  // ------------------------------------------------------------ fichas

  listEntities(kind?: EntityKind, q?: string): EntitySummary[] {
    const where = ['deleted_at is null']
    const args: unknown[] = []
    if (kind) {
      where.push('kind = ?')
      args.push(kind)
    }
    const rows = this.db
      .prepare(`select * from entities where ${where.join(' and ')} order by is_player desc, name collate nocase`)
      .all(...args) as EntityRow[]
    if (!q?.trim()) return rows.map(summary)
    const needle = q.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    return rows
      .filter((r) => `${r.name} ${r.role} ${r.aliases}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(needle))
      .map(summary)
  }

  getEntity(id: string): EntityDetail {
    const r = this.db.prepare('select * from entities where id = ?').get(id) as EntityRow | undefined
    if (!r) throw new Error('Ficha não encontrada.')
    const mentions = this.db
      .prepare(
        `select m.source_type, m.source_id, m.hits, coalesce(s.title, d.title, 'Sessão ' || g.number, e2.name, '') as title
         from mentions m
         left join scenes s on m.source_type = 'scene' and s.id = m.source_id
         left join documents d on m.source_type = 'document' and d.id = m.source_id
         left join game_sessions g on m.source_type = 'session' and g.id = m.source_id
         left join entities e2 on m.source_type = 'entity' and e2.id = m.source_id
         where m.entity_id = ? and s.deleted_at is null and d.deleted_at is null and g.deleted_at is null and e2.deleted_at is null
         order by m.source_type desc, s.game_minute_start, s.sort, d.sort`
      )
      .all(id) as { source_type: MentionRef['sourceType']; source_id: string; hits: number; title: string }[]
    const events = this.db
      .prepare(
        `select t.id, t.title from timeline_event_entities te join timeline_events t on t.id = te.event_id
         where te.entity_id = ? and t.deleted_at is null order by t.game_minute_start`
      )
      .all(id) as { id: string; title: string }[]
    const clues = this.db
      .prepare(
        `select c.id, c.title from clue_links cl join clues c on c.id = cl.clue_id
         where cl.entity_id = ? and c.deleted_at is null order by c.title`
      )
      .all(id) as { id: string; title: string }[]
    return {
      ...entity(r),
      mentionedIn: [
        ...mentions.map((m) => ({ sourceType: m.source_type, sourceId: m.source_id, hits: m.hits, title: m.title || 'Sem título' })),
        ...events.map((e) => ({ sourceType: 'event' as const, sourceId: e.id, hits: 1, title: e.title || 'Sem título' })),
        ...clues.map((c) => ({ sourceType: 'clue' as const, sourceId: c.id, hits: 1, title: c.title || 'Sem título' }))
      ]
    }
  }

  saveEntity(input: EntityInput): Entity {
    const now = nowIso()
    const id = input.id ?? newId()
    const templateId = input.kind === 'personagem' || input.kind === 'criatura' ? this.campaign().systemTemplateId : null
    const exists = input.id && this.db.prepare('select 1 from entities where id = ?').get(input.id)
    const aliases = JSON.stringify(input.aliases.map((a) => a.trim()).filter(Boolean))
    const customs = JSON.stringify(input.customAttributes.filter((a) => a.label.trim() || a.value.trim()))
    const tx = this.db.transaction(() => {
      if (exists) {
        this.db
          .prepare(
            `update entities set kind = ?, is_player = ?, name = ?, role = ?, aliases = ?, stats = ?, description = ?, personality = ?,
             portrait_id = ?, custom_attributes = ?, map_id = coalesce(?, map_id), notes = coalesce(?, notes), updated_at = ? where id = ?`
          )
          .run(
            input.kind,
            input.isPlayer ? 1 : 0,
            input.name,
            input.role,
            aliases,
            JSON.stringify(input.stats),
            input.description,
            input.personality,
            input.portraitId,
            customs,
            input.mapId === undefined ? null : input.mapId,
            input.notes === undefined ? null : input.notes,
            now,
            id
          )
        // coalesce mantém o que não veio; null explícito (tirar o mapa) é aplicado aqui.
        if (input.mapId === null) this.db.prepare('update entities set map_id = null where id = ?').run(id)
      } else {
        this.db
          .prepare(
            `insert into entities (id, kind, is_player, name, role, aliases, system_template_id, stats, description, personality, portrait_id, custom_attributes,
             map_id, notes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            input.kind,
            input.isPlayer ? 1 : 0,
            input.name,
            input.role,
            aliases,
            templateId,
            JSON.stringify(input.stats),
            input.description,
            input.personality,
            input.portraitId,
            customs,
            input.mapId ?? null,
            input.notes ?? null,
            now,
            now
          )
      }
      this.indexEntity(id)
      // Nome ou apelido mudou: as menções de todos os textos precisam ser refeitas.
      this.matcher = null
      this.reindexAllMentions()
    })
    tx()
    return entity(this.db.prepare('select * from entities where id = ?').get(id) as EntityRow)
  }

  private indexEntity(id: string): void {
    const r = this.db.prepare('select * from entities where id = ?').get(id) as EntityRow
    const e = entity(r)
    const customs = e.customAttributes.map((a) => `${a.label} ${a.value}`).join('\n')
    this.indexSearch('entity', id, e.name, [e.role, e.aliases.join(' '), e.description, e.personality, customs, docText(e.notes)].join('\n'))
    this.indexMentions('entity', id, docText(e.notes))
  }

  /** Busca e menções da cena: título, resumo, texto e os blocos de notas. */
  private indexScene(id: string): void {
    const s = this.db.prepare('select title, summary, body from scenes where id = ?').get(id) as { title: string; summary: string; body: string | null }
    const notes = (this.db.prepare('select title, body from scene_notes where scene_id = ? order by sort').all(id) as { title: string; body: string }[])
      .map((n) => `${n.title}\n${n.body}`)
      .join('\n')
    const text = `${docText(s.body)}\n${notes}`
    this.indexSearch('scene', id, s.title, `${s.summary}\n${text}`)
    this.indexMentions('scene', id, `${s.title}\n${s.summary}\n${text}`)
  }

  saveSceneNote(input: { id?: string; sceneId: string; title: string; body: string }): SceneNote {
    const now = nowIso()
    const id = input.id ?? newId()
    this.db.transaction(() => {
      if (input.id && this.db.prepare('select 1 from scene_notes where id = ?').get(input.id)) {
        this.db.prepare('update scene_notes set title = ?, body = ?, updated_at = ? where id = ?').run(input.title, input.body, now, id)
      } else {
        const sort = (this.db.prepare('select coalesce(max(sort), 0) + 1 as n from scene_notes where scene_id = ?').get(input.sceneId) as { n: number }).n
        this.db.prepare('insert into scene_notes (id, scene_id, title, body, sort, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)').run(id, input.sceneId, input.title, input.body, sort, now, now)
      }
      this.indexScene(input.sceneId)
    })()
    return { id, title: input.title, body: input.body }
  }

  deleteSceneNote(id: string): void {
    const n = this.db.prepare('select scene_id from scene_notes where id = ?').get(id) as { scene_id: string } | undefined
    if (!n) return
    this.db.transaction(() => {
      this.db.prepare('delete from scene_notes where id = ?').run(id)
      this.indexScene(n.scene_id)
    })()
  }

  /** Ordem de planejamento (corkboard). A lista por hora no jogo não muda. */
  reorderScenes(ids: string[]): void {
    const set = this.db.prepare('update scenes set sort = ? where id = ?')
    this.db.transaction(() => ids.forEach((id, i) => set.run(i + 1, id)))()
  }

  listScenesBySort(): SceneSummary[] {
    const rows = this.db
      .prepare('select s.*, l.name as location_name from scenes s left join entities l on l.id = s.location_id where s.deleted_at is null order by s.sort, s.created_at')
      .all() as SceneRow[]
    return rows.map(sceneSummary)
  }

  /** Fichas de outra campanha, só leitura (para escolher o que trazer). */
  static peekEntities(otherPath: string): EntitySummary[] {
    const other = new Database(join(otherPath, 'campanha.sqlite'), { readonly: true, fileMustExist: true })
    try {
      return (other.prepare('select * from entities where deleted_at is null order by kind, name collate nocase').all() as EntityRow[]).map(summary)
    } finally {
      other.close()
    }
  }

  /**
   * Traz fichas de outra campanha (NPCs que voltam, agentes da Ordem): copia tudo, com retrato e mapa.
   * Ficha com o mesmo nome e tipo que já existe aqui não é duplicada.
   */
  importEntitiesFrom(otherPath: string, ids: string[]): { imported: number; skipped: string[] } {
    const other = new Database(join(otherPath, 'campanha.sqlite'), { readonly: true, fileMustExist: true })
    try {
      const fileOf = (attId: string | null) => {
        if (!attId) return null
        const a = other.prepare('select rel_path from attachments where id = ?').get(attId) as { rel_path: string } | undefined
        if (!a || !a.rel_path.startsWith('anexos/') || a.rel_path.includes('..')) return null
        const src = join(otherPath, a.rel_path)
        return existsSync(src) ? this.importFile(src).attachment.id : null
      }
      const existing = new Set(this.listEntities().map((e) => `${e.kind}:${fold(e.name)}`))
      const skipped: string[] = []
      let imported = 0
      for (const id of ids) {
        const r = other.prepare('select * from entities where id = ? and deleted_at is null').get(id) as (EntityRow & { map_id?: string | null; notes?: string | null }) | undefined
        if (!r) continue
        if (existing.has(`${r.kind}:${fold(r.name)}`)) {
          skipped.push(r.name || 'Sem nome')
          continue
        }
        const e = entity(r as EntityRow)
        this.saveEntity({
          kind: e.kind,
          name: e.name,
          role: e.role,
          isPlayer: e.isPlayer,
          aliases: e.aliases,
          stats: e.stats,
          description: e.description,
          personality: e.personality,
          customAttributes: e.customAttributes,
          portraitId: fileOf(r.portrait_id),
          mapId: fileOf(r.map_id ?? null),
          notes: r.notes ?? null
        })
        existing.add(`${r.kind}:${fold(r.name)}`)
        imported++
      }
      return { imported, skipped }
    } finally {
      other.close()
    }
  }

  trashEntity(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('update entities set deleted_at = ? where id = ?').run(nowIso(), id)
      this.db.prepare("delete from search_index where ref_type = 'entity' and ref_id = ?").run(id)
      this.db.prepare('delete from mentions where entity_id = ?').run(id)
      this.matcher = null
    })()
  }

  mentionTargets(): MentionTargetDTO[] {
    const rows = this.db.prepare("select id, name, aliases, kind from entities where deleted_at is null and name <> ''").all() as {
      id: string
      name: string
      aliases: string
      kind: EntityKind
    }[]
    return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, aliases: parseJson<string[]>(r.aliases, []) }))
  }

  // ------------------------------------------------------------ cenas

  listScenes(): SceneSummary[] {
    const rows = this.db
      .prepare(
        `select s.*, l.name as location_name from scenes s left join entities l on l.id = s.location_id
         where s.deleted_at is null
         order by s.game_minute_start is null, s.game_minute_start, s.sort`
      )
      .all() as SceneRow[]
    return rows.map(sceneSummary)
  }

  getScene(id: string): Scene {
    const r = this.db
      .prepare('select s.*, l.name as location_name from scenes s left join entities l on l.id = s.location_id where s.id = ?')
      .get(id) as SceneRow | undefined
    if (!r) throw new Error('Cena não encontrada.')
    const mentions = this.db
      .prepare(
        `select e.id, e.name, e.kind from mentions m join entities e on e.id = m.entity_id
         where m.source_type = 'scene' and m.source_id = ? and e.deleted_at is null order by e.kind, e.name`
      )
      .all(id) as Scene['mentions']
    const notes = this.db.prepare('select id, title, body from scene_notes where scene_id = ? order by sort, created_at').all(id) as SceneNote[]
    return { ...sceneSummary(r), summary: r.summary, body: r.body, mentions, attachments: this.sceneAttachments(id), notes }
  }

  saveScene(input: SceneInput): Scene {
    if (input.gameMinuteEnd !== null && input.gameMinuteStart === null) throw new Error('Defina o início da cena antes do fim.')
    if (input.gameMinuteEnd !== null && input.gameMinuteStart !== null && input.gameMinuteEnd < input.gameMinuteStart)
      throw new Error('O fim da cena não pode ser antes do início.')
    const now = nowIso()
    const id = input.id ?? newId()
    const exists = input.id && this.db.prepare('select 1 from scenes where id = ?').get(input.id)
    this.db.transaction(() => {
      if (exists) {
        this.db
          .prepare(
            `update scenes set title = ?, summary = ?, body = ?, status = ?, location_id = ?, game_minute_start = ?, game_minute_end = ?, updated_at = ?
             where id = ?`
          )
          .run(input.title, input.summary, input.body, input.status, input.locationId, input.gameMinuteStart, input.gameMinuteEnd, now, id)
      } else {
        const sort = (this.db.prepare('select coalesce(max(sort), 0) + 1 as n from scenes').get() as { n: number }).n
        this.db
          .prepare(
            `insert into scenes (id, title, summary, body, sort, status, location_id, game_minute_start, game_minute_end, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(id, input.title, input.summary, input.body, sort, input.status, input.locationId, input.gameMinuteStart, input.gameMinuteEnd, now, now)
      }
      this.indexScene(id)
    })()
    return this.getScene(id)
  }

  trashScene(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('update scenes set deleted_at = ? where id = ?').run(nowIso(), id)
      this.db.prepare("delete from search_index where ref_type = 'scene' and ref_id = ?").run(id)
      this.db.prepare("delete from mentions where source_type = 'scene' and source_id = ?").run(id)
    })()
  }

  // ------------------------------------------------------------ linha do tempo

  private eventRows(where: string, ...args: unknown[]): TimelineEvent[] {
    const rows = this.db
      .prepare(
        `select t.*, l.name as location_name from timeline_events t left join entities l on l.id = t.location_id
         where ${where} order by t.game_minute_start, t.title`
      )
      .all(...args) as EventRow[]
    const links = this.db
      .prepare(
        `select te.event_id, e.id, e.name, e.kind from timeline_event_entities te join entities e on e.id = te.entity_id
         where e.deleted_at is null order by e.kind, e.name`
      )
      .all() as { event_id: string; id: string; name: string; kind: EntityKind }[]
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      ifIgnored: r.if_ignored,
      status: r.status,
      gameMinuteStart: r.game_minute_start,
      gameMinuteEnd: r.game_minute_end,
      sceneId: r.scene_id,
      locationId: r.location_id,
      locationName: r.location_name,
      entities: links.filter((l) => l.event_id === r.id).map(({ id, name, kind }) => ({ id, name, kind }))
    }))
  }

  timeline(): TimelineData {
    return { scenes: this.listScenes(), events: this.eventRows('t.deleted_at is null') }
  }

  getEvent(id: string): TimelineEvent {
    const [e] = this.eventRows('t.id = ?', id)
    if (!e) throw new Error('Evento não encontrado.')
    return e
  }

  saveEvent(input: TimelineEventInput): TimelineEvent {
    if (input.gameMinuteEnd !== null && input.gameMinuteEnd < input.gameMinuteStart) throw new Error('O fim do evento não pode ser antes do início.')
    const now = nowIso()
    const id = input.id ?? newId()
    const exists = input.id && this.db.prepare('select 1 from timeline_events where id = ?').get(input.id)
    this.db.transaction(() => {
      if (exists) {
        this.db
          .prepare(
            `update timeline_events set title = ?, description = ?, if_ignored = ?, status = ?, game_minute_start = ?, game_minute_end = ?,
             scene_id = ?, location_id = ?, updated_at = ? where id = ?`
          )
          .run(input.title, input.description, input.ifIgnored, input.status, input.gameMinuteStart, input.gameMinuteEnd, input.sceneId, input.locationId, now, id)
      } else {
        this.db
          .prepare(
            `insert into timeline_events (id, title, description, if_ignored, status, game_minute_start, game_minute_end, scene_id, location_id, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(id, input.title, input.description, input.ifIgnored, input.status, input.gameMinuteStart, input.gameMinuteEnd, input.sceneId, input.locationId, now, now)
      }
      this.indexSearch('event', id, input.title, `${input.description}\n${input.ifIgnored}`)
      this.linkEventEntities(id, `${input.title}\n${input.description}\n${input.ifIgnored}`)
    })()
    return this.getEvent(id)
  }

  trashEvent(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('update timeline_events set deleted_at = ? where id = ?').run(nowIso(), id)
      this.db.prepare("delete from search_index where ref_type = 'event' and ref_id = ?").run(id)
    })()
  }

  /** Mesma regra das cenas: quem é citado no texto do evento fica ligado a ele. */
  private linkEventEntities(eventId: string, text: string): void {
    this.db.prepare('delete from timeline_event_entities where event_id = ?').run(eventId)
    const insert = this.db.prepare('insert or ignore into timeline_event_entities (event_id, entity_id) values (?, ?)')
    for (const m of findMentions(text, this.currentMatcher())) insert.run(eventId, m.id)
  }

  // ------------------------------------------------------------ anexos

  /** Copia a imagem para anexos/ com nome legível. O mesmo arquivo duas vezes vira um anexo só. */
  importImage(src: string): Attachment {
    return this.importFile(src, { imagesOnly: true }).attachment
  }

  /** Imagem ou PDF para anexos/. `reused` diz se o mesmo conteúdo já estava na campanha. */
  importFile(src: string, opts: { imagesOnly?: boolean } = {}): { attachment: Attachment; reused: boolean } {
    const ext = extname(src).toLowerCase()
    const mime = IMAGE_MIME[ext] ?? (opts.imagesOnly ? undefined : PDF_MIME[ext])
    if (!mime) throw new Error(`Formato não aceito. Use ${(opts.imagesOnly ? IMAGE_EXTENSIONS : IMPORT_EXTENSIONS).join(', ')}.`)
    if (!existsSync(src) || !statSync(src).isFile()) throw new Error('Arquivo não encontrado.')
    const size = statSync(src).size
    if (size > MAX_ATTACHMENT_BYTES) throw new Error('Arquivo maior que 200 MB.')
    const sha = createHash('sha256').update(readFileSync(src)).digest('hex')
    const existing = this.db.prepare('select * from attachments where sha256 = ?').get(sha) as AttachmentRow | undefined
    if (existing) {
      this.db.prepare('update attachments set deleted_at = null, updated_at = ? where id = ?').run(nowIso(), existing.id)
      if (!existsSync(join(this.path, existing.rel_path))) copyFileSync(src, join(this.path, existing.rel_path))
      return { attachment: attachment(existing), reused: true }
    }
    const relPath = `anexos/${slug(basename(src, extname(src)))}-${sha.slice(0, 6)}${ext}`
    mkdirSync(join(this.path, 'anexos'), { recursive: true })
    copyFileSync(src, join(this.path, relPath))
    const id = newId()
    const now = nowIso()
    this.db
      .prepare(
        `insert into attachments (id, kind, file_name, rel_path, mime, size_bytes, sha256, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, guessKind(basename(src), mime), basename(src), relPath, mime, size, sha, now, now)
    return { attachment: this.getAttachment(id), reused: false }
  }

  /** Vários arquivos: cada um por si, um erro não para os outros. */
  importFiles(paths: string[]): ImportResult {
    const out: ImportResult = { imported: [], reused: [], errors: [] }
    for (const p of paths) {
      try {
        const r = this.importFile(p)
        ;(r.reused ? out.reused : out.imported).push(r.attachment)
      } catch (e) {
        out.errors.push({ file: basename(p), message: (e as Error).message })
      }
    }
    return out
  }

  listAttachments(): AttachmentDetail[] {
    const rows = this.db.prepare('select * from attachments where deleted_at is null order by created_at desc, file_name').all() as (AttachmentRow & { created_at: string })[]
    return rows.map((r) => ({ ...attachment(r), createdAt: r.created_at, usedIn: this.attachmentUses(r.id) }))
  }

  getAttachmentDetail(id: string): AttachmentDetail {
    const r = this.db.prepare('select * from attachments where id = ?').get(id) as (AttachmentRow & { created_at: string }) | undefined
    if (!r) throw new Error('Arquivo não encontrado.')
    return { ...attachment(r), createdAt: r.created_at, usedIn: this.attachmentUses(id) }
  }

  setAttachmentKind(id: string, kind: Attachment['kind']): AttachmentDetail {
    this.db.prepare('update attachments set kind = ?, updated_at = ? where id = ?').run(kind, nowIso(), id)
    return this.getAttachmentDetail(id)
  }

  private attachmentUses(id: string): AttachmentUse[] {
    const q = <T>(sql: string) => this.db.prepare(sql).all(id) as T[]
    return [
      ...q<{ id: string; title: string; pdf_page: number | null }>(
        `select s.id, s.title, sa.pdf_page from scene_attachments sa join scenes s on s.id = sa.scene_id
         where sa.attachment_id = ? and s.deleted_at is null order by s.game_minute_start, s.sort`
      ).map((r) => ({ type: 'scene' as const, id: r.id, title: r.title || 'Sem título', pdfPage: r.pdf_page })),
      ...q<{ id: string; title: string }>("select id, name as title from entities where portrait_id = ? and deleted_at is null").map((r) => ({
        type: 'entity' as const,
        id: r.id,
        title: r.title || 'Sem nome'
      })),
      ...q<{ id: string; title: string }>('select id, title from clues where image_id = ? and deleted_at is null').map((r) => ({ type: 'clue' as const, id: r.id, title: r.title || 'Sem título' })),
      ...q<{ id: string; title: string }>(
        'select distinct b.id, b.name as title from board_nodes n join boards b on b.id = n.board_id where n.attachment_id = ? and b.deleted_at is null'
      ).map((r) => ({ type: 'board' as const, id: r.id, title: r.title })),
      ...q<{ id: string; title: string }>('select id, name as title from campaign where cover_id = ?').map((r) => ({ type: 'campaign' as const, id: r.id, title: r.title }))
    ]
  }

  sceneAttachments(sceneId: string): SceneAttachment[] {
    const rows = this.db
      .prepare(
        `select a.*, sa.pdf_page from scene_attachments sa join attachments a on a.id = sa.attachment_id
         where sa.scene_id = ? and a.deleted_at is null order by a.kind = 'pdf' desc, sa.pdf_page, a.file_name`
      )
      .all(sceneId) as (AttachmentRow & { pdf_page: number | null })[]
    return rows.map((r) => ({ attachment: attachment(r), pdfPage: r.pdf_page }))
  }

  /** Liga um arquivo à cena; ligar de novo só troca a página. */
  attachToScene(sceneId: string, attachmentId: string, pdfPage: number | null): Scene {
    this.db
      .prepare(
        `insert into scene_attachments (scene_id, attachment_id, pdf_page) values (?, ?, ?)
         on conflict (scene_id, attachment_id) do update set pdf_page = excluded.pdf_page`
      )
      .run(sceneId, attachmentId, pdfPage)
    return this.getScene(sceneId)
  }

  detachFromScene(sceneId: string, attachmentId: string): Scene {
    this.db.prepare('delete from scene_attachments where scene_id = ? and attachment_id = ?').run(sceneId, attachmentId)
    return this.getScene(sceneId)
  }

  getAttachment(id: string): Attachment {
    const r = this.db.prepare('select * from attachments where id = ?').get(id) as AttachmentRow | undefined
    if (!r) throw new Error('Anexo não encontrado.')
    return attachment(r)
  }

  /** Arquivo no disco para o protocolo magistrado://. Só devolve o que está dentro de anexos/. */
  attachmentFile(id: string): { file: string; mime: string } | null {
    const r = this.db.prepare('select rel_path, mime from attachments where id = ?').get(id) as { rel_path: string; mime: string } | undefined
    if (!r || !r.rel_path.startsWith('anexos/') || r.rel_path.includes('..')) return null
    return { file: join(this.path, r.rel_path), mime: r.mime }
  }

  // ------------------------------------------------------------ sessões de jogo

  listSessions(): GameSession[] {
    const rows = this.db.prepare('select id, number, played_on from game_sessions where deleted_at is null order by number').all() as {
      id: string
      number: number
      played_on: string | null
    }[]
    return rows.map((r) => ({ id: r.id, number: r.number, playedOn: r.played_on }))
  }

  createSession(playedOn: string | null): GameSession {
    const number = (this.db.prepare('select coalesce(max(number), 0) + 1 as n from game_sessions').get() as { n: number }).n
    const id = newId()
    const now = nowIso()
    this.db
      .prepare('insert into game_sessions (id, number, played_on, game_minute_start, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
      .run(id, number, playedOn, this.campaign().currentGameMinute, now, now)
    return { id, number, playedOn }
  }

  getSession(id: string): GameSessionDetail {
    const r = this.db.prepare('select id, number, played_on, game_minute_start, notes from game_sessions where id = ? and deleted_at is null').get(id) as
      | { id: string; number: number; played_on: string | null; game_minute_start: number | null; notes: string | null }
      | undefined
    if (!r) throw new Error('Sessão não encontrada.')
    return { id: r.id, number: r.number, playedOn: r.played_on, gameMinuteStart: r.game_minute_start, notes: r.notes }
  }

  /** Notas da mesa: entram na busca e ligam as fichas citadas, como qualquer texto. */
  saveSessionNotes(id: string, notes: string | null): void {
    this.db.transaction(() => {
      const s = this.db.prepare('update game_sessions set notes = ?, game_minute_end = ?, updated_at = ? where id = ? and deleted_at is null').run(
        notes,
        this.campaign().currentGameMinute,
        nowIso(),
        id
      )
      if (!s.changes) throw new Error('Sessão não encontrada.')
      const { number } = this.getSession(id)
      const text = docText(notes)
      this.indexSearch('session', id, `Sessão ${number}`, text)
      this.indexMentions('session', id, text)
    })()
  }

  // ------------------------------------------------------------ pistas

  private clueRows(where: string, ...args: unknown[]): Clue[] {
    const rows = this.db
      .prepare(
        `select c.*, s.title as planned_scene_title, l.name as location_name, g.number as found_session_number
         from clues c
         left join scenes s on s.id = c.planned_scene_id and s.deleted_at is null
         left join entities l on l.id = c.location_id and l.deleted_at is null
         left join game_sessions g on g.id = c.found_session_id and g.deleted_at is null
         where ${where} order by c.sort, c.created_at`
      )
      .all(...args) as ClueRow[]
    const finders = this.db
      .prepare('select cf.clue_id, e.id, e.name from clue_finders cf join entities e on e.id = cf.entity_id where e.deleted_at is null order by e.name')
      .all() as { clue_id: string; id: string; name: string }[]
    const links = this.db
      .prepare(
        `select cl.clue_id, e.id, e.name, e.kind from clue_links cl join entities e on e.id = cl.entity_id
         where e.deleted_at is null order by e.kind, e.name`
      )
      .all() as { clue_id: string; id: string; name: string; kind: EntityKind }[]
    const images = new Map(
      (this.db.prepare('select a.* from attachments a join clues c on c.image_id = a.id').all() as AttachmentRow[]).map((a) => [a.id, attachment(a)])
    )
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      reveals: r.reveals,
      status: r.status,
      image: r.image_id ? (images.get(r.image_id) ?? null) : null,
      // Cena, lugar ou sessão na lixeira contam como "sem".
      plannedSceneId: r.planned_scene_title === null ? null : r.planned_scene_id,
      plannedSceneTitle: r.planned_scene_title,
      locationId: r.location_name === null ? null : r.location_id,
      locationName: r.location_name,
      foundGameMinute: r.found_game_minute,
      foundSessionId: r.found_session_number === null ? null : r.found_session_id,
      foundSessionNumber: r.found_session_number,
      finders: finders.filter((f) => f.clue_id === r.id).map(({ id, name }) => ({ id, name })),
      links: links.filter((l) => l.clue_id === r.id).map(({ id, name, kind }) => ({ id, name, kind }))
    }))
  }

  listClues(): Clue[] {
    return this.clueRows('c.deleted_at is null')
  }

  getClue(id: string): Clue {
    const [c] = this.clueRows('c.id = ?', id)
    if (!c) throw new Error('Pista não encontrada.')
    return c
  }

  saveClue(input: ClueInput): Clue {
    const now = nowIso()
    const id = input.id ?? newId()
    const exists = input.id && this.db.prepare('select 1 from clues where id = ?').get(input.id)
    // Oculta não guarda quando nem quem achou. Achada sem hora nem sessão ganha a hora atual do jogo.
    const hidden = input.status === 'oculta'
    const foundSession = hidden ? null : input.foundSessionId
    const foundMinute = hidden ? null : (input.foundGameMinute ?? (foundSession ? null : this.campaign().currentGameMinute))
    const finderIds = hidden ? [] : input.finderIds
    this.db.transaction(() => {
      const values = [input.title, input.description, input.reveals, input.status, input.imageId, input.plannedSceneId, input.locationId, foundMinute, foundSession]
      if (exists) {
        this.db
          .prepare(
            `update clues set title = ?, description = ?, reveals = ?, status = ?, image_id = ?, planned_scene_id = ?, location_id = ?,
             found_game_minute = ?, found_session_id = ?, updated_at = ? where id = ?`
          )
          .run(...values, now, id)
      } else {
        const sort = (this.db.prepare('select coalesce(max(sort), 0) + 1 as n from clues').get() as { n: number }).n
        this.db
          .prepare(
            `insert into clues (title, description, reveals, status, image_id, planned_scene_id, location_id, found_game_minute, found_session_id,
             id, sort, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(...values, id, sort, now, now)
      }
      this.db.prepare('delete from clue_finders where clue_id = ?').run(id)
      const addFinder = this.db.prepare('insert or ignore into clue_finders (clue_id, entity_id) values (?, ?)')
      for (const f of finderIds) addFinder.run(id, f)
      this.indexSearch('clue', id, input.title, `${input.description}\n${input.reveals}`)
      this.linkClueEntities(id, `${input.title}\n${input.description}\n${input.reveals}`)
    })()
    return this.getClue(id)
  }

  trashClue(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('update clues set deleted_at = ? where id = ?').run(nowIso(), id)
      this.db.prepare("delete from search_index where ref_type = 'clue' and ref_id = ?").run(id)
    })()
  }

  /** Mesma regra das cenas e eventos: quem é citado na pista fica ligado a ela. */
  private linkClueEntities(clueId: string, text: string): void {
    this.db.prepare('delete from clue_links where clue_id = ?').run(clueId)
    const insert = this.db.prepare('insert or ignore into clue_links (clue_id, entity_id) values (?, ?)')
    for (const m of findMentions(text, this.currentMatcher())) insert.run(clueId, m.id)
  }

  // ------------------------------------------------------------ quadros (canvas)

  listBoards(): BoardSummary[] {
    const rows = this.db
      .prepare(
        `select b.id, b.name, (select count(*) from board_nodes n where n.board_id = b.id) as node_count
         from boards b where b.deleted_at is null order by b.sort, b.created_at`
      )
      .all() as { id: string; name: string; node_count: number }[]
    return rows.map((r) => ({ id: r.id, name: r.name, nodeCount: r.node_count }))
  }

  createBoard(name: string): Board {
    const id = newId()
    const now = nowIso()
    const sort = (this.db.prepare('select coalesce(max(sort), 0) + 1 as n from boards').get() as { n: number }).n
    this.db.prepare('insert into boards (id, name, sort, created_at, updated_at) values (?, ?, ?, ?, ?)').run(id, name, sort, now, now)
    return this.getBoard(id)
  }

  getBoard(id: string): Board {
    const b = this.db.prepare('select id, name, viewport from boards where id = ? and deleted_at is null').get(id) as
      | { id: string; name: string; viewport: string }
      | undefined
    if (!b) throw new Error('Quadro não encontrado.')
    const rows = this.db.prepare('select * from board_nodes where board_id = ? order by created_at').all(id) as {
      id: string
      type: BoardNode['type']
      entity_id: string | null
      clue_id: string | null
      scene_id: string | null
      attachment_id: string | null
      content: string
      color: string | null
      x: number
      y: number
      w: number | null
      h: number | null
    }[]
    const entities = this.db.prepare('select id, name, role, kind, is_player, portrait_id, deleted_at from entities where id = ?')
    const clues = this.db.prepare('select c.title, c.status, c.deleted_at, a.id as image_id from clues c left join attachments a on a.id = c.image_id where c.id = ?')
    const scenes = this.db.prepare('select s.title, s.game_minute_start, s.deleted_at, l.name as place from scenes s left join entities l on l.id = s.location_id where s.id = ?')
    const files = this.db.prepare('select id, file_name, deleted_at from attachments where id = ?')
    const ref = (n: (typeof rows)[number]): BoardNode['ref'] => {
      if (n.type === 'entity') {
        const e = entities.get(n.entity_id) as
          | { name: string; role: string; kind: EntityKind; is_player: number; portrait_id: string | null; deleted_at: string | null }
          | undefined
        return {
          title: e?.name || 'Sem nome',
          subtitle: e?.role ?? '',
          kind: e?.kind,
          isPlayer: e?.is_player === 1,
          imageUrl: e?.portrait_id ? `magistrado://anexo/${e.portrait_id}` : null,
          missing: !e || !!e.deleted_at
        }
      }
      if (n.type === 'clue') {
        const c = clues.get(n.clue_id) as { title: string; status: Clue['status']; deleted_at: string | null; image_id: string | null } | undefined
        return { title: c?.title || 'Sem título', subtitle: '', clueStatus: c?.status, imageUrl: c?.image_id ? `magistrado://anexo/${c.image_id}` : null, missing: !c || !!c.deleted_at }
      }
      if (n.type === 'scene') {
        const s = scenes.get(n.scene_id) as { title: string; game_minute_start: number | null; deleted_at: string | null; place: string | null } | undefined
        return { title: s?.title || 'Sem título', subtitle: s?.place ?? '', gameMinute: s?.game_minute_start ?? null, missing: !s || !!s.deleted_at }
      }
      if (n.type === 'image') {
        const a = files.get(n.attachment_id) as { id: string; file_name: string; deleted_at: string | null } | undefined
        return { title: a?.file_name ?? '', subtitle: '', imageUrl: a ? `magistrado://anexo/${a.id}` : null, missing: !a || !!a.deleted_at }
      }
      return null
    }
    const edges = this.db.prepare('select id, from_node, to_node, label from board_edges where board_id = ? order by created_at').all(id) as {
      id: string
      from_node: string
      to_node: string
      label: string
    }[]
    return {
      id: b.id,
      name: b.name,
      viewport: parseJson(b.viewport, { x: 0, y: 0, zoom: 1 }),
      nodes: rows.map((n) => ({
        id: n.id,
        type: n.type,
        entityId: n.entity_id,
        clueId: n.clue_id,
        sceneId: n.scene_id,
        attachmentId: n.attachment_id,
        content: n.content,
        color: n.color,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        ref: ref(n)
      })),
      edges: edges.map((e) => ({ id: e.id, from: e.from_node, to: e.to_node, label: e.label }))
    }
  }

  saveBoard(input: BoardSave): Board {
    const now = nowIso()
    const ids = new Set(input.nodes.map((n) => n.id))
    this.db.transaction(() => {
      const owner = this.db.prepare('select 1 from boards where id = ? and deleted_at is null').get(input.id)
      if (!owner) throw new Error('Quadro não encontrado.')
      this.db.prepare('update boards set name = ?, viewport = ?, updated_at = ? where id = ?').run(input.name, JSON.stringify(input.viewport), now, input.id)
      this.db.prepare('delete from board_edges where board_id = ?').run(input.id)
      const existing = this.db.prepare('select id from board_nodes where board_id = ?').all(input.id) as { id: string }[]
      const del = this.db.prepare('delete from board_nodes where id = ?')
      for (const n of existing) if (!ids.has(n.id)) del.run(n.id)
      const upsert = this.db.prepare(
        `insert into board_nodes (id, board_id, type, entity_id, clue_id, scene_id, attachment_id, content, color, x, y, w, h, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set content = excluded.content, color = excluded.color, x = excluded.x, y = excluded.y,
           w = excluded.w, h = excluded.h, updated_at = excluded.updated_at
         where board_nodes.board_id = excluded.board_id`
      )
      for (const n of input.nodes)
        upsert.run(n.id, input.id, n.type, n.entityId, n.clueId, n.sceneId, n.attachmentId, n.content, n.color, n.x, n.y, n.w, n.h, now, now)
      const edge = this.db.prepare('insert into board_edges (id, board_id, from_node, to_node, label, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)')
      for (const e of input.edges) if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) edge.run(e.id, input.id, e.from, e.to, e.label, now, now)
    })()
    return this.getBoard(input.id)
  }

  trashBoard(id: string): void {
    this.db.prepare('update boards set deleted_at = ? where id = ?').run(nowIso(), id)
  }

  // ------------------------------------------------------------ textos (páginas livres)

  listDocuments(): DocumentSummary[] {
    const rows = this.db.prepare('select id, title, updated_at from documents where deleted_at is null order by sort, created_at').all() as {
      id: string
      title: string
      updated_at: string
    }[]
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }))
  }

  getDocument(id: string): TextDocument {
    const r = this.db.prepare('select id, title, body, updated_at from documents where id = ?').get(id) as
      | { id: string; title: string; body: string | null; updated_at: string }
      | undefined
    if (!r) throw new Error('Texto não encontrado.')
    const mentions = this.db
      .prepare(
        `select e.id, e.name, e.kind from mentions m join entities e on e.id = m.entity_id
         where m.source_type = 'document' and m.source_id = ? and e.deleted_at is null order by e.kind, e.name`
      )
      .all(id) as TextDocument['mentions']
    return { id: r.id, title: r.title, body: r.body, updatedAt: r.updated_at, mentions }
  }

  saveDocument(input: DocumentInput): TextDocument {
    const now = nowIso()
    const id = input.id ?? newId()
    const exists = input.id && this.db.prepare('select 1 from documents where id = ?').get(input.id)
    this.db.transaction(() => {
      if (exists) this.db.prepare('update documents set title = ?, body = ?, updated_at = ? where id = ?').run(input.title, input.body, now, id)
      else {
        const sort = (this.db.prepare('select coalesce(max(sort), 0) + 1 as n from documents').get() as { n: number }).n
        this.db.prepare('insert into documents (id, title, body, sort, created_at, updated_at) values (?, ?, ?, ?, ?, ?)').run(id, input.title, input.body, sort, now, now)
      }
      this.indexDocument(id)
    })()
    return this.getDocument(id)
  }

  private indexDocument(id: string): void {
    const d = this.db.prepare('select title, body from documents where id = ?').get(id) as { title: string; body: string | null }
    const text = docText(d.body)
    this.indexSearch('document', id, d.title, text)
    this.indexMentions('document', id, `${d.title}\n${text}`)
  }

  trashDocument(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('update documents set deleted_at = ? where id = ?').run(nowIso(), id)
      this.db.prepare("delete from search_index where ref_type = 'document' and ref_id = ?").run(id)
      this.db.prepare("delete from mentions where source_type = 'document' and source_id = ?").run(id)
    })()
  }

  // ------------------------------------------------------------ lixeira

  private static TRASH_TABLE: Record<TrashType, { table: string; title: string; detail: string }> = {
    entity: { table: 'entities', title: 'name', detail: 'kind' },
    scene: { table: 'scenes', title: 'title', detail: "'Cena'" },
    event: { table: 'timeline_events', title: 'title', detail: "'Evento'" },
    clue: { table: 'clues', title: 'title', detail: "'Pista'" },
    board: { table: 'boards', title: 'name', detail: "'Quadro'" },
    document: { table: 'documents', title: 'title', detail: "'Texto'" }
  }

  listTrash(): TrashItem[] {
    const items: TrashItem[] = []
    for (const [type, t] of Object.entries(CampaignStore.TRASH_TABLE) as [TrashType, (typeof CampaignStore.TRASH_TABLE)[TrashType]][]) {
      const rows = this.db
        .prepare(`select id, ${t.title} as title, ${t.detail} as detail, deleted_at from ${t.table} where deleted_at is not null`)
        .all() as { id: string; title: string; detail: string; deleted_at: string }[]
      for (const r of rows) items.push({ type, id: r.id, title: r.title || 'Sem título', detail: r.detail, deletedAt: r.deleted_at })
    }
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  }

  /** Tira da lixeira e refaz busca e ligações, como se tivesse acabado de salvar. */
  restore(type: TrashType, id: string): void {
    const t = CampaignStore.TRASH_TABLE[type]
    this.db.transaction(() => {
      const changed = this.db.prepare(`update ${t.table} set deleted_at = null, updated_at = ? where id = ? and deleted_at is not null`).run(nowIso(), id)
      if (!changed.changes) throw new Error('Esse item não está na lixeira.')
      if (type === 'entity') {
        this.matcher = null
        this.indexEntity(id)
        this.reindexAllMentions()
      } else if (type === 'scene') this.indexScene(id)
      else if (type === 'event') {
        const e = this.db.prepare('select title, description, if_ignored from timeline_events where id = ?').get(id) as { title: string; description: string; if_ignored: string }
        this.indexSearch('event', id, e.title, `${e.description}\n${e.if_ignored}`)
        this.linkEventEntities(id, `${e.title}\n${e.description}\n${e.if_ignored}`)
      } else if (type === 'clue') {
        const c = this.db.prepare('select title, description, reveals from clues where id = ?').get(id) as { title: string; description: string; reveals: string }
        this.indexSearch('clue', id, c.title, `${c.description}\n${c.reveals}`)
        this.linkClueEntities(id, `${c.title}\n${c.description}\n${c.reveals}`)
      } else if (type === 'document') this.indexDocument(id)
    })()
  }

  /** Apaga de vez. As chaves estrangeiras levam junto o que depende do item (nós do quadro, ligações). */
  purge(type: TrashType, id: string): void {
    const t = CampaignStore.TRASH_TABLE[type]
    this.db.transaction(() => {
      const row = this.db.prepare(`select 1 from ${t.table} where id = ? and deleted_at is not null`).get(id)
      if (!row) throw new Error('Só dá para apagar de vez o que está na lixeira.')
      if (type === 'scene' || type === 'document') this.db.prepare('delete from mentions where source_type = ? and source_id = ?').run(type, id)
      this.db.prepare('delete from search_index where ref_type = ? and ref_id = ?').run(type, id)
      this.db.prepare(`delete from ${t.table} where id = ?`).run(id)
    })()
  }

  /** Ao abrir a campanha: o que está na lixeira há mais de `days` dias sai de vez. */
  purgeOld(days = 60): number {
    const limit = new Date(Date.now() - days * 86_400_000).toISOString()
    const old = this.listTrash().filter((i) => i.deletedAt < limit)
    for (const i of old) this.purge(i.type, i.id)
    return old.length
  }

  /** Refaz busca e ligações de tudo (depois de restaurar do campanha.json, ou para reparo). */
  rebuildIndexes(): void {
    this.db.transaction(() => {
      this.db.exec('delete from search_index; delete from mentions; delete from timeline_event_entities; delete from clue_links;')
      this.matcher = null
      const ids = (sql: string) => (this.db.prepare(sql).all() as { id: string }[]).map((r) => r.id)
      for (const id of ids('select id from entities where deleted_at is null')) this.indexEntity(id)
      for (const id of ids('select id from documents where deleted_at is null')) this.indexDocument(id)
      for (const id of ids('select id from scenes where deleted_at is null')) this.indexScene(id)
      for (const id of ids('select id from timeline_events where deleted_at is null')) {
        const e = this.db.prepare('select title, description, if_ignored from timeline_events where id = ?').get(id) as { title: string; description: string; if_ignored: string }
        this.indexSearch('event', id, e.title, `${e.description}\n${e.if_ignored}`)
      }
      for (const id of ids('select id from clues where deleted_at is null')) {
        const c = this.db.prepare('select title, description, reveals from clues where id = ?').get(id) as { title: string; description: string; reveals: string }
        this.indexSearch('clue', id, c.title, `${c.description}\n${c.reveals}`)
      }
      for (const id of ids("select id from game_sessions where deleted_at is null and notes is not null")) {
        const s = this.getSession(id)
        this.indexSearch('session', id, `Sessão ${s.number}`, docText(s.notes))
        this.indexMentions('session', id, docText(s.notes))
      }
      this.reindexAllMentions()
    })()
  }

  // ------------------------------------------------------------ menções e busca

  private currentMatcher(): Matcher {
    if (!this.matcher) this.matcher = buildMatcher(this.mentionTargets())
    return this.matcher
  }

  private indexMentions(sourceType: MentionRef['sourceType'], sourceId: string, text: string): void {
    this.db.prepare('delete from mentions where source_type = ? and source_id = ?').run(sourceType, sourceId)
    const hits = new Map<string, number>()
    for (const m of findMentions(text, this.currentMatcher())) {
      if (sourceType === 'entity' && m.id === sourceId) continue
      hits.set(m.id, (hits.get(m.id) ?? 0) + 1)
    }
    const insert = this.db.prepare('insert into mentions (entity_id, source_type, source_id, hits) values (?, ?, ?, ?)')
    for (const [entityId, n] of hits) insert.run(entityId, sourceType, sourceId, n)
  }

  reindexAllMentions(): void {
    const scenes = this.db.prepare('select id, title, summary, body from scenes where deleted_at is null').all() as {
      id: string
      title: string
      summary: string
      body: string | null
    }[]
    for (const s of scenes) this.indexScene(s.id)
    const withNotes = this.db.prepare('select id from entities where deleted_at is null and notes is not null').all() as { id: string }[]
    for (const e of withNotes) this.indexEntity(e.id)
    const docs = this.db.prepare('select id, title, body from documents where deleted_at is null').all() as { id: string; title: string; body: string | null }[]
    for (const d of docs) this.indexMentions('document', d.id, `${d.title}\n${docText(d.body)}`)
    const events = this.db.prepare('select id, title, description, if_ignored from timeline_events where deleted_at is null').all() as {
      id: string
      title: string
      description: string
      if_ignored: string
    }[]
    for (const e of events) this.linkEventEntities(e.id, `${e.title}\n${e.description}\n${e.if_ignored}`)
    const clues = this.db.prepare('select id, title, description, reveals from clues where deleted_at is null').all() as {
      id: string
      title: string
      description: string
      reveals: string
    }[]
    for (const c of clues) this.linkClueEntities(c.id, `${c.title}\n${c.description}\n${c.reveals}`)
  }

  private indexSearch(refType: SearchRefType, refId: string, title: string, body: string): void {
    this.db.prepare('delete from search_index where ref_type = ? and ref_id = ?').run(refType, refId)
    this.db.prepare('insert into search_index (ref_type, ref_id, title, body) values (?, ?, ?, ?)').run(refType, refId, title, body)
  }

  search(q: string, limit = 20): SearchResult[] {
    // Cada palavra vira um prefixo entre aspas: "auré" acha "Aurélio", sem quebrar com aspas ou operadores digitados.
    const tokens = q
      .normalize('NFC')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map((t) => `"${t}"*`)
    if (tokens.length === 0) return []
    const rows = this.db
      .prepare(
        `select ref_type, ref_id, title, snippet(search_index, 3, '[', ']', '…', 10) as snippet
         from search_index where search_index match ? order by bm25(search_index, 0, 0, 8, 1) limit ?`
      )
      .all(tokens.join(' '), limit) as { ref_type: SearchRefType; ref_id: string; title: string; snippet: string }[]
    const kinds = new Map(
      (this.db.prepare('select id, kind from entities').all() as { id: string; kind: EntityKind }[]).map((r) => [r.id, r.kind])
    )
    return rows.map((r) => ({
      refType: r.ref_type,
      refId: r.ref_id,
      title: r.title || 'Sem título',
      snippet: r.snippet,
      kind: r.ref_type === 'entity' ? kinds.get(r.ref_id) : undefined
    }))
  }
}
