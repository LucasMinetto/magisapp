import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { createBackup, listBackups, restoreBackup } from './backup'
import { adiarAtualizacao, aplicarAtualizacao, estadoAtualizacao, verificarAtualizacao } from './atualizacao'
import { exportCampaign } from './export-run'
import { ACTION_LABEL, UndoLog } from './undo'
import { applyStructure, BUILTIN_STRUCTURES, structureFromCampaign } from './structures'
import {
  backupConfig,
  backupRecent,
  closeCampaign,
  forgetRecent,
  knownRecent,
  removeUserStructure,
  renameRecent,
  saveUserStructure,
  userStructures,
  createCampaign,
  defaultCampaignsDir,
  openCampaign,
  recentCampaigns,
  remember as rememberCampaign,
  setBackupConfig
} from './campaigns'
import { CampaignStore, IMAGE_EXTENSIONS, IMPORT_EXTENSIONS } from './store'
import { join } from 'node:path'
import { copyToCampaign, LibraryStore } from './library'
import { LIVROS, LIVROS_VERSAO } from './livros'
import { TOKEN_EXTENSIONS } from './tokens'
import { iniciativaSchema, rolagemSchema, type Iniciativa, type RolagemInput } from '../shared/ordem/esquemas'
import {
  ATTACHMENT_KINDS,
  BOARD_NODE_TYPES,
  CLUE_STATUSES,
  ENTITY_KINDS,
  EVENT_STATUSES,
  EXPORT_FORMATS,
  EXPORT_SECTIONS,
  LIBRARY_KINDS,
  SCENE_STATUSES,
  SHEET_SIZES,
  SOURCE_KINDS,
  TRASH_TYPES,
  type BoardSave,
  type ExportFormat,
  type ExportSection,
  type IpcResult,
  type LibraryKind,
  type SheetSize,
  type SourceKind,
  type TrashType
} from '../shared/types'

let store: CampaignStore | null = null
// Algo mudou desde o último backup? Só então o automático roda.
let dirty = false
let lastBackupAt = Date.now()
let exported: string | null = null
// Histórico de desfazer da campanha aberta (só na memória; some ao fechar).
let history: UndoLog | null = null

const need = (): CampaignStore => {
  if (!store) throw new Error('Nenhuma campanha aberta.')
  return store
}

/** Backup automático se houve mudança. Falhar aqui nunca impede fechar a campanha. */
function autoBackup(): void {
  if (!store || !dirty) return
  try {
    const cfg = backupConfig()
    createBackup(store, cfg.dir, { auto: true, keep: cfg.keep })
    dirty = false
    lastBackupAt = Date.now()
  } catch (err) {
    console.error('[backup] automático falhou', err)
  }
}

/** Chamado a cada minuto: faz o automático quando passou o intervalo configurado. */
export function autoBackupTick(): void {
  const { intervalMin } = backupConfig()
  if (intervalMin > 0 && Date.now() - lastBackupAt >= intervalMin * 60_000) autoBackup()
}

const swap = (next: CampaignStore) => {
  closeCurrent()
  store = next
  history = new UndoLog(next.db)
  dirty = false
  lastBackupAt = Date.now()
  return next.campaign()
}

// Biblioteca única (fora das campanhas): abre na primeira vez que alguém pede.
let lib: LibraryStore | null = null
const library = (): LibraryStore => (lib ??= new LibraryStore(join(app.getPath('userData'), 'biblioteca.sqlite'), { dados: LIVROS, versao: LIVROS_VERSAO, tokens: join(app.getAppPath(), 'resources', 'livros-tokens') }))

/** Arquivo de um token da biblioteca (magistrado://token/<nome>). */
export function libraryTokenFile(nome: string): string | null {
  return library().tokenFile(nome)
}

export function closeLibrary(): void {
  lib?.close()
  lib = null
}

/** A campanha aberta, para o protocolo magistrado:// achar os anexos. */
export const currentStore = (): CampaignStore | null => store

export function closeCurrent(): void {
  autoBackup()
  if (store) closeCampaign(store)
  store = null
  history = null
}

/** Desfaz ou refaz e refaz a busca e as ligações (tabelas derivadas não entram no histórico). */
function travel(direction: 'undo' | 'redo') {
  const s = need()
  if (!history) throw new Error('Nada para desfazer.')
  const label = direction === 'undo' ? history.undo() : history.redo()
  if (label) {
    s.rebuildIndexes()
    dirty = true
  }
  return { label, campaign: s.campaign(), state: history.state() }
}

// Canais que mudam a campanha (marcam que precisa de backup).
const WRITES = /:(save|trash|update|set|advance|import|pickImage|restore|purge|saveNotes|create|add|remove|setSheet|saveInitiative|copyToCampaign)$/
// A biblioteca tem banco e backup próprios: só trazer para a campanha muda a campanha.
const marksDirty = (name: string) =>
  WRITES.test(name) &&
  (!name.startsWith('campaign:') || name === 'campaign:update') &&
  !name.startsWith('backup:') &&
  (!name.startsWith('library:') || name === 'library:copyToCampaign' || name === 'library:tokenToCampaign')

const id = z.string().uuid()
const kind = z.enum(ENTITY_KINDS)
const minute = z.number().int().nullable()
const statValue = z.union([
  z.number(),
  z.string(),
  z.array(z.string()),
  z.object({ current: z.number(), max: z.number() })
])

const entityInput = z.object({
  id: id.optional(),
  kind,
  name: z.string().max(200),
  role: z.string().max(300),
  isPlayer: z.boolean(),
  aliases: z.array(z.string().max(120)).max(30),
  stats: z.record(z.string(), statValue),
  description: z.string().max(20_000),
  personality: z.string().max(20_000),
  portraitId: id.nullable(),
  mapId: id.nullable().optional(),
  notes: z.string().max(2_000_000).nullable().optional(),
  sheet: z.enum(SHEET_SIZES).optional(),
  // Validado no store conforme o tipo da ficha (completa ou ameaça).
  sheetData: z.unknown().optional(),
  customAttributes: z.array(z.object({ label: z.string().max(80), value: z.string().max(2_000) })).max(60)
})

const trashRef = z.object({ type: z.enum(TRASH_TYPES), id })
const libraryKind = z.enum(LIBRARY_KINDS)


const sceneInput = z.object({
  id: id.optional(),
  title: z.string().max(300),
  summary: z.string().max(5_000),
  body: z.string().max(2_000_000).nullable(),
  status: z.enum(SCENE_STATUSES),
  locationId: id.nullable(),
  gameMinuteStart: minute,
  gameMinuteEnd: minute
})

const eventInput = z.object({
  id: id.optional(),
  title: z.string().max(300),
  description: z.string().max(20_000),
  ifIgnored: z.string().max(5_000),
  status: z.enum(EVENT_STATUSES),
  gameMinuteStart: z.number().int(),
  gameMinuteEnd: minute,
  sceneId: id.nullable(),
  locationId: id.nullable()
})

const coord = z.number().finite().min(-1e6).max(1e6)
const boardSave = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  viewport: z.object({ x: coord, y: coord, zoom: z.number().min(0.01).max(10) }),
  nodes: z
    .array(
      z.object({
        id,
        type: z.enum(BOARD_NODE_TYPES),
        entityId: id.nullable(),
        clueId: id.nullable(),
        sceneId: id.nullable(),
        attachmentId: id.nullable(),
        content: z.string().max(20_000),
        color: z.string().max(30).nullable(),
        x: coord,
        y: coord,
        w: coord.nullable(),
        h: coord.nullable()
      })
    )
    .max(2_000),
  edges: z.array(z.object({ id, from: id, to: id, label: z.string().max(200) })).max(5_000)
})

const clueInput = z.object({
  id: id.optional(),
  title: z.string().max(300),
  description: z.string().max(20_000),
  reveals: z.string().max(20_000),
  status: z.enum(CLUE_STATUSES),
  imageId: id.nullable(),
  plannedSceneId: id.nullable(),
  locationId: id.nullable(),
  foundGameMinute: minute,
  foundSessionId: id.nullable(),
  finderIds: z.array(id).max(20)
})

// Cada canal: um esquema zod para a entrada e a função. A interface nunca fala direto com o banco.
const channels: Record<string, [z.ZodTypeAny, (input: never, win: BrowserWindow) => unknown]> = {
  'campaign:recent': [z.undefined(), () => recentCampaigns()],
  'campaign:create': [
    z.object({ name: z.string().trim().min(1).max(120), epochDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), example: z.boolean().optional() }),
    (input: { name: string; epochDate: string; example?: boolean }) => swap(createCampaign(input))
  ],
  'campaign:open': [z.string().min(1), (path: string) => swap(openCampaign(path))],
  'campaign:pickAndOpen': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Abrir campanha',
        defaultPath: defaultCampaignsDir(),
        properties: ['openDirectory']
      })
      return res.canceled || !res.filePaths[0] ? null : swap(openCampaign(res.filePaths[0]))
    }
  ],
  'campaign:current': [z.undefined(), () => store?.campaign() ?? null],
  'campaign:counts': [z.undefined(), () => need().counts()],
  'campaign:close': [z.undefined(), () => closeCurrent()],
  'campaign:reveal': [z.undefined(), () => shell.openPath(need().path).then(() => undefined)],
  'campaign:renameRecent': [
    z.object({ path: z.string().min(1).max(1_000), name: z.string().trim().min(1).max(120) }),
    (input: { path: string; name: string }) => renameRecent(input.path, input.name)
  ],
  'campaign:revealRecent': [
    z.string().min(1).max(1_000),
    async (path: string) => {
      knownRecent(path)
      const err = await shell.openPath(path)
      if (err) throw new Error(err)
    }
  ],
  'campaign:backupRecent': [z.string().min(1).max(1_000), (path: string) => backupRecent(path)],
  // Excluir manda a pasta para a Lixeira do Windows: dá para recuperar por lá.
  'campaign:trashRecent': [
    z.string().min(1).max(1_000),
    async (path: string) => {
      knownRecent(path)
      if (store?.path === path) throw new Error('Feche a campanha antes de excluir.')
      await shell.trashItem(path)
      forgetRecent(path)
    }
  ],
  'campaign:update': [
    z.object({ name: z.string().trim().min(1).max(120), tagline: z.string().max(300), coverId: id.nullable() }),
    (input: { name: string; tagline: string; coverId: string | null }) => {
      const c = need().updateCampaign(input)
      rememberCampaign(c.name, c.path)
      return c
    }
  ],
  'documents:list': [z.undefined(), () => need().listDocuments()],
  'documents:get': [id, (input: string) => need().getDocument(input)],
  'documents:save': [
    z.object({ id: id.optional(), title: z.string().max(300), body: z.string().max(5_000_000).nullable() }),
    (input: { id?: string; title: string; body: string | null }) => need().saveDocument(input)
  ],
  'documents:trash': [id, (input: string) => need().trashDocument(input)],
  'structures:list': [z.undefined(), () => [...BUILTIN_STRUCTURES, ...userStructures()]],
  'structures:apply': [
    z.string().min(1).max(100),
    (input: string) => {
      const t = [...BUILTIN_STRUCTURES, ...userStructures()].find((x) => x.id === input)
      if (!t) throw new Error('Modelo não encontrado.')
      return applyStructure(need(), t)
    }
  ],
  'structures:save': [
    z.string().trim().min(1).max(80),
    (name: string) => {
      const t = structureFromCampaign(need(), name)
      saveUserStructure(t)
      return t
    }
  ],
  'structures:remove': [
    z.string().min(1).max(100),
    (input: string) => {
      if (BUILTIN_STRUCTURES.some((x) => x.id === input)) throw new Error('Os modelos que vêm com o app não podem ser apagados.')
      removeUserStructure(input)
    }
  ],
  'history:state': [z.undefined(), () => history?.state() ?? { undo: null, redo: null }],
  'history:undo': [z.undefined(), () => travel('undo')],
  'history:redo': [z.undefined(), () => travel('redo')],
  'export:run': [
    z.object({ format: z.enum(EXPORT_FORMATS), sections: z.array(z.enum(EXPORT_SECTIONS)).min(1), gmOnly: z.boolean() }),
    (input: { format: ExportFormat; sections: ExportSection[]; gmOnly: boolean }, win: BrowserWindow) => exportCampaign(need(), input, win, (p) => (exported = p))
  ],
  // Só mostra o último arquivo exportado nesta sessão: o caminho vem da tela.
  'export:reveal': [z.string().min(1).max(1_000), (path: string) => (path === exported ? shell.showItemInFolder(path) : undefined)],
  'backup:config': [z.undefined(), () => backupConfig()],
  'backup:setConfig': [
    z.object({ intervalMin: z.number().int().min(0).max(24 * 60), keep: z.number().int().min(1).max(100) }),
    (input: { intervalMin: number; keep: number }) => setBackupConfig(input)
  ],
  'backup:pickDir': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, { title: 'Pasta dos backups', defaultPath: backupConfig().dir, properties: ['openDirectory', 'createDirectory'] })
      return res.canceled || !res.filePaths[0] ? null : setBackupConfig({ dir: res.filePaths[0] })
    }
  ],
  'backup:now': [
    z.undefined(),
    () => {
      const s = need()
      const { file } = createBackup(s, backupConfig().dir)
      dirty = false
      lastBackupAt = Date.now()
      return listBackups(backupConfig().dir, s.campaign().name).find((b) => b.file === file)!
    }
  ],
  'backup:list': [z.undefined(), () => listBackups(backupConfig().dir, need().campaign().name)],
  // O caminho vem da tela: só mostra o que está na lista de backups desta campanha.
  'backup:reveal': [
    z.string().min(1).max(1_000),
    (file: string) => {
      if (!listBackups(backupConfig().dir, need().campaign().name).some((b) => b.file === file)) throw new Error('Esse arquivo não está na lista de backups.')
      shell.showItemInFolder(file)
    }
  ],
  'backup:pickAndRestore': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Restaurar um backup',
        defaultPath: backupConfig().dir,
        properties: ['openFile'],
        filters: [{ name: 'Backup do Magistrado', extensions: ['magistrado-backup', 'zip'] }]
      })
      if (res.canceled || !res.filePaths[0]) return null
      const { path } = restoreBackup(res.filePaths[0], defaultCampaignsDir())
      const next = openCampaign(path)
      next.rebuildIndexes() // vale para os dois caminhos; obrigatório quando veio do json
      return swap(next)
    }
  ],
  'trash:list': [z.undefined(), () => need().listTrash()],
  'trash:restore': [trashRef, (input: { type: TrashType; id: string }) => need().restore(input.type, input.id)],
  'trash:purge': [trashRef, (input: { type: TrashType; id: string }) => need().purge(input.type, input.id)],
  'templates:list': [z.undefined(), () => need().templates()],
  'entities:list': [
    z.object({ kind: kind.optional(), q: z.string().max(200).optional() }),
    (input: { kind?: (typeof ENTITY_KINDS)[number]; q?: string }) => need().listEntities(input.kind, input.q)
  ],
  'entities:get': [id, (input: string) => need().getEntity(input)],
  'entities:setSheet': [
    z.object({ id, sheet: z.enum(SHEET_SIZES) }),
    (input: { id: string; sheet: SheetSize }) => need().setSheet(input.id, input.sheet)
  ],
  'rolls:list': [
    z.object({ entityId: id.optional(), sessionId: id.optional(), limit: z.number().int().min(1).max(500).optional() }),
    (input: { entityId?: string; sessionId?: string; limit?: number }) => need().listRolls(input)
  ],
  'rolls:add': [rolagemSchema, (input: RolagemInput) => need().addRoll(input)],
  'rolls:remove': [id, (input: string) => need().removeRoll(input)],
  'library:sources': [z.undefined(), () => library().sources()],
  'library:saveSource': [
    z.object({ id: id.optional(), name: z.string().trim().min(1).max(120), kind: z.enum(SOURCE_KINDS), abbreviation: z.string().max(20) }),
    (input: { id?: string; name: string; kind: SourceKind; abbreviation: string }) => library().saveSource(input)
  ],
  'library:deleteSource': [id, (input: string) => library().deleteSource(input)],
  'library:list': [
    z.object({ kind: libraryKind, sourceId: id.optional(), q: z.string().max(200).optional() }),
    (input: { kind: LibraryKind; sourceId?: string; q?: string }) => library().list(input.kind, input)
  ],
  'library:get': [z.object({ kind: libraryKind, id }), (input: { kind: LibraryKind; id: string }) => library().get(input.kind, input.id)],
  // O conteúdo é validado na biblioteca pelo esquema do tipo (ameaça, item ou ritual).
  'library:save': [
    z.object({ kind: libraryKind, id: id.optional(), sourceId: id, data: z.unknown() }),
    (input: { kind: LibraryKind; id?: string; sourceId: string; data: unknown }) => library().save(input.kind, input)
  ],
  'library:remove': [z.object({ kind: libraryKind, id }), (input: { kind: LibraryKind; id: string }) => library().remove(input.kind, input.id)],
  'library:copyToCampaign': [
    z.object({ kind: libraryKind, id, entityId: id.optional() }),
    (input: { kind: LibraryKind; id: string; entityId?: string }) => copyToCampaign(need(), library(), input)
  ],
  'library:backup': [z.undefined(), () => library().backup(backupConfig().dir)],
  'library:pickAndRestore': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Restaurar a biblioteca',
        defaultPath: backupConfig().dir,
        properties: ['openFile'],
        filters: [{ name: 'Backup da biblioteca', extensions: ['magistrado-backup', 'zip'] }]
      })
      if (res.canceled || !res.filePaths[0]) return false
      library().restore(res.filePaths[0])
      return true
    }
  ],
  'library:pickToken': [
    id,
    async (input: string, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Token da ameaça',
        properties: ['openFile'],
        filters: [{ name: 'Imagens', extensions: TOKEN_EXTENSIONS }]
      })
      if (res.canceled || !res.filePaths[0]) return null
      return library().setToken(input, res.filePaths[0])
    }
  ],
  'library:clearToken': [id, (input: string) => library().setToken(input, null)],
  // Um token da biblioteca (variante) vira anexo da campanha, para servir de retrato da ficha.
  'library:tokenToCampaign': [
    z.string().regex(/^[a-f0-9]{16}\.[a-z]{3,4}$/),
    (nome: string) => {
      const f = library().tokenFile(nome)
      if (!f) throw new Error('Este token não está mais na biblioteca.')
      return need().importFile(f, { imagesOnly: true }).attachment
    }
  ],
  'entities:save': [entityInput, (input: z.infer<typeof entityInput>) => need().saveEntity(input)],
  'entities:trash': [id, (input: string) => need().trashEntity(input)],
  'entities:peekOther': [
    z.string().min(1).max(1_000),
    (path: string) => {
      knownRecent(path)
      if (path === need().path) throw new Error('Essa é a campanha aberta.')
      return CampaignStore.peekEntities(path)
    }
  ],
  'entities:importFrom': [
    z.object({ path: z.string().min(1).max(1_000), ids: z.array(id).min(1).max(500) }),
    (input: { path: string; ids: string[] }) => {
      knownRecent(input.path)
      if (input.path === need().path) throw new Error('Essa é a campanha aberta.')
      return need().importEntitiesFrom(input.path, input.ids)
    }
  ],
  'entities:mentionTargets': [z.undefined(), () => need().mentionTargets()],
  'scenes:list': [z.undefined(), () => need().listScenes()],
  'scenes:get': [id, (input: string) => need().getScene(input)],
  'scenes:save': [sceneInput, (input: z.infer<typeof sceneInput>) => need().saveScene(input)],
  'scenes:trash': [id, (input: string) => need().trashScene(input)],
  // Um ano de jogo para cada lado é folga de sobra; fora disso é erro de digitação.
  'clock:set': [z.number().int().min(-525_600).max(525_600), (input: number) => need().setClock(input)],
  'clock:advance': [z.number().int().min(-525_600).max(525_600), (input: number) => need().advanceClock(input)],
  'timeline:list': [z.undefined(), () => need().timeline()],
  'events:get': [id, (input: string) => need().getEvent(input)],
  'events:save': [eventInput, (input: z.infer<typeof eventInput>) => need().saveEvent(input)],
  'events:trash': [id, (input: string) => need().trashEvent(input)],
  'attachments:pickImage': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Escolher imagem',
        properties: ['openFile'],
        filters: [{ name: 'Imagens', extensions: IMAGE_EXTENSIONS }]
      })
      return res.canceled || !res.filePaths[0] ? null : need().importImage(res.filePaths[0])
    }
  ],
  'attachments:import': [z.string().min(1).max(1_000), (input: string) => need().importImage(input)],
  'attachments:pickFiles': [
    z.undefined(),
    async (_: never, win: BrowserWindow) => {
      const res = await dialog.showOpenDialog(win, {
        title: 'Importar arquivos da aventura',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'PDF e imagens', extensions: IMPORT_EXTENSIONS },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Imagens e tokens', extensions: IMAGE_EXTENSIONS }
        ]
      })
      return res.canceled || res.filePaths.length === 0 ? null : need().importFiles(res.filePaths)
    }
  ],
  'attachments:importPaths': [z.array(z.string().min(1).max(1_000)).min(1).max(200), (input: string[]) => need().importFiles(input)],
  'attachments:list': [z.undefined(), () => need().listAttachments()],
  'attachments:get': [id, (input: string) => need().getAttachmentDetail(input)],
  'attachments:setKind': [
    z.object({ id, kind: z.enum(ATTACHMENT_KINDS) }),
    (input: { id: string; kind: (typeof ATTACHMENT_KINDS)[number] }) => need().setAttachmentKind(input.id, input.kind)
  ],
  'attachments:openExternal': [
    id,
    async (input: string) => {
      const f = need().attachmentFile(input)
      if (!f) throw new Error('Arquivo não encontrado.')
      const err = await shell.openPath(f.file)
      if (err) throw new Error(err)
    }
  ],
  'scenes:saveNote': [
    z.object({ id: id.optional(), sceneId: id, title: z.string().max(200), body: z.string().max(20_000) }),
    (input: { id?: string; sceneId: string; title: string; body: string }) => need().saveSceneNote(input)
  ],
  'scenes:deleteNote': [id, (input: string) => need().deleteSceneNote(input)],
  'scenes:reorder': [z.array(id).max(2_000), (input: string[]) => need().reorderScenes(input)],
  'scenes:attach': [
    z.object({ sceneId: id, attachmentId: id, pdfPage: z.number().int().min(1).max(100_000).nullable() }),
    (input: { sceneId: string; attachmentId: string; pdfPage: number | null }) => need().attachToScene(input.sceneId, input.attachmentId, input.pdfPage)
  ],
  'scenes:detach': [
    z.object({ sceneId: id, attachmentId: id }),
    (input: { sceneId: string; attachmentId: string }) => need().detachFromScene(input.sceneId, input.attachmentId)
  ],
  'sessions:list': [z.undefined(), () => need().listSessions()],
  'sessions:create': [
    z.object({ playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
    (input: { playedOn: string | null }) => need().createSession(input.playedOn)
  ],
  'sessions:get': [id, (input: string) => need().getSession(input)],
  'sessions:saveNotes': [
    z.object({ id, notes: z.string().max(5_000_000).nullable() }),
    (input: { id: string; notes: string | null }) => need().saveSessionNotes(input.id, input.notes)
  ],
  'sessions:initiative': [id, (input: string) => need().getInitiative(input)],
  'sessions:saveInitiative': [
    z.object({ id, initiative: iniciativaSchema }),
    (input: { id: string; initiative: Iniciativa }) => need().saveInitiative(input.id, input.initiative)
  ],
  'clues:list': [z.undefined(), () => need().listClues()],
  'clues:get': [id, (input: string) => need().getClue(input)],
  'clues:save': [clueInput, (input: z.infer<typeof clueInput>) => need().saveClue(input)],
  'clues:trash': [id, (input: string) => need().trashClue(input)],
  'boards:list': [z.undefined(), () => need().listBoards()],
  'boards:create': [z.string().trim().min(1).max(120), (input: string) => need().createBoard(input)],
  'boards:get': [id, (input: string) => need().getBoard(input)],
  'boards:save': [boardSave, (input: BoardSave) => need().saveBoard(input)],
  'boards:trash': [id, (input: string) => need().trashBoard(input)],
  'update:state': [z.undefined(), () => estadoAtualizacao()],
  'update:check': [z.undefined(), () => verificarAtualizacao()],
  'update:later': [z.undefined(), () => adiarAtualizacao()],
  'update:apply': [z.undefined(), () => aplicarAtualizacao()],
  'search:query': [
    z.object({ q: z.string().max(200), limit: z.number().int().min(1).max(50).optional() }),
    (input: { q: string; limit?: number }) => need().search(input.q, input.limit)
  ]
}

export const CHANNELS = Object.keys(channels)

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  for (const [name, [schema, handler]] of Object.entries(channels)) {
    ipcMain.handle(name, async (_event, raw): Promise<IpcResult<unknown>> => {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) return { ok: false, error: `Dados inválidos em ${name}: ${parsed.error.issues[0]?.message ?? ''}` }
      // Cada ação que muda a campanha vira um passo do desfazer.
      const end = marksDirty(name) && history ? history.begin(ACTION_LABEL[name] ?? 'alteração') : null
      try {
        const data = await handler(parsed.data as never, getWindow()!)
        if (marksDirty(name)) dirty = true
        return { ok: true, data }
      } catch (err) {
        console.error(`[ipc] ${name}`, err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      } finally {
        end?.()
      }
    })
  }
}
