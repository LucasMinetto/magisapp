// Contrato entre a interface (renderer) e o processo principal. Um só lugar para os dois lados.

export const ENTITY_KINDS = ['personagem', 'criatura', 'local', 'grupo', 'lore'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export const SCENE_STATUSES = ['planejada', 'jogada', 'pulada'] as const
export type SceneStatus = (typeof SCENE_STATUSES)[number]

export const CLUE_STATUSES = ['oculta', 'achada', 'entendida'] as const
export type ClueStatus = (typeof CLUE_STATUSES)[number]

export const EVENT_STATUSES = ['planejado', 'aconteceu', 'evitado'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export interface RecentCampaign {
  name: string
  path: string
  openedAt: string
  /** Lidos da própria pasta; vazios se a campanha não abrir. */
  tagline: string | null
  epochDate: string | null
  coverUrl: string | null
  counts: { entities: number; scenes: number; clues: number } | null
}

export interface Campaign {
  id: string
  name: string
  epochDate: string
  currentGameMinute: number
  tagline: string | null
  coverId: string | null
  coverUrl: string | null
  systemTemplateId: string | null
  path: string
}

export interface CampaignUpdate {
  name: string
  tagline: string
  coverId: string | null
}

export interface CampaignCounts {
  entities: number
  scenes: number
  clues: number
  sessions: number
}

export interface TemplateField {
  id: string
  entityKind: EntityKind
  key: string
  label: string
  type: 'number' | 'text' | 'longtext' | 'select' | 'list' | 'resource'
  groupName: string
  /** optional: campo de regra opcional, escondido na ficha até ter valor ou ser pedido. */
  options: { choices?: string[]; optional?: boolean }
  sort: number
}

export interface SystemTemplate {
  id: string
  name: string
  fields: TemplateField[]
}

export interface EntitySummary {
  id: string
  kind: EntityKind
  name: string
  role: string
  isPlayer: boolean
  /** magistrado://anexo/<id> do retrato, ou null (mostra as iniciais). */
  portraitUrl: string | null
  updatedAt: string
}

/** Atributo que o mestre cria na ficha, fora do modelo do sistema ("Deve favor a", "Arma"). */
export interface CustomAttribute {
  label: string
  value: string
}

/** Recurso (PV, PE, Sanidade): atual e máximo. Os outros campos são número, texto ou lista. */
export type StatValue = number | string | string[] | { current: number; max: number }

export interface Entity extends EntitySummary {
  portraitId: string | null
  /** Mapa do lugar: uma imagem pronta (não há editor de mapa). */
  mapId: string | null
  mapUrl: string | null
  /** Notas livres do mestre, JSON do editor, com menções. */
  notes: string | null
  customAttributes: CustomAttribute[]
  aliases: string[]
  systemTemplateId: string | null
  stats: Record<string, StatValue>
  description: string
  personality: string
}

export interface MentionRef {
  sourceType: 'scene' | 'document' | 'clue' | 'session' | 'entity' | 'event'
  sourceId: string
  title: string
  hits: number
}

export interface EntityDetail extends Entity {
  mentionedIn: MentionRef[]
}

export interface EntityInput {
  id?: string
  kind: EntityKind
  name: string
  role: string
  isPlayer: boolean
  aliases: string[]
  stats: Record<string, StatValue>
  description: string
  personality: string
  portraitId: string | null
  customAttributes: CustomAttribute[]
  mapId?: string | null
  notes?: string | null
}

/** Bloco de notas do mestre dentro de uma cena ("Se eles forem ao porão…", "Lembrar"). */
export interface SceneNote {
  id: string
  title: string
  body: string
}

export interface DocumentSummary {
  id: string
  title: string
  updatedAt: string
}

/** Página livre: introdução, regras da casa, a aventura reescrita no seu formato. */
export interface TextDocument extends DocumentSummary {
  body: string | null
  mentions: { id: string; name: string; kind: EntityKind }[]
}

export interface DocumentInput {
  id?: string
  title: string
  body: string | null
}

export interface HistoryResult {
  /** Nome da ação desfeita/refeita; null se não havia nada. */
  label: string | null
  campaign: Campaign
  state: { undo: string | null; redo: string | null }
}

export interface StructureScene {
  title: string
  summary: string
  /** Minutos depois da primeira cena; null = cena sem hora. */
  offset: number | null
}

export interface StructureTemplate {
  id: string
  name: string
  description: string
  builtin: boolean
  scenes: StructureScene[]
}

export const EXPORT_FORMATS = ['pdf', 'docx', 'txt', 'obsidian'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]
export const EXPORT_SECTIONS = ['linha-do-tempo', 'cenas', 'fichas', 'pistas', 'sessoes', 'textos'] as const
export type ExportSection = (typeof EXPORT_SECTIONS)[number]

export interface ExportOptions {
  sections: ExportSection[]
  /** false = versão para os jogadores: sem segredos, sem "o que revela", sem pistas ocultas nem eventos que não aconteceram. */
  gmOnly: boolean
}

export interface BackupConfig {
  dir: string
  /** Minutos entre backups automáticos; 0 desliga (o de ao fechar continua). */
  intervalMin: number
  /** Quantos automáticos guardar por campanha. Os manuais nunca são apagados. */
  keep: number
}

export interface BackupEntry {
  file: string
  name: string
  auto: boolean
  sizeBytes: number
  createdAt: string
}

export const TRASH_TYPES = ['entity', 'scene', 'event', 'clue', 'board', 'document'] as const
export type TrashType = (typeof TRASH_TYPES)[number]

export interface TrashItem {
  type: TrashType
  id: string
  title: string
  detail: string
  deletedAt: string
}

export interface SceneSummary {
  id: string
  title: string
  status: SceneStatus
  sort: number
  locationId: string | null
  locationName: string | null
  gameMinuteStart: number | null
  gameMinuteEnd: number | null
  /** Resumo curto (aparece no cartão do corkboard). */
  summaryText: string
}

export interface Scene extends SceneSummary {
  summary: string
  body: string | null
  mentions: { id: string; name: string; kind: EntityKind }[]
  /** Material da cena: o PDF da aventura na página certa, tokens, mapas. */
  attachments: SceneAttachment[]
  notes: SceneNote[]
}

export interface SceneInput {
  id?: string
  title: string
  summary: string
  body: string | null
  status: SceneStatus
  locationId: string | null
  gameMinuteStart: number | null
  gameMinuteEnd: number | null
}

/** Algo que acontece no mundo numa hora marcada, com ou sem os jogadores (o ritual, a morte do enfermeiro). */
export interface TimelineEvent {
  id: string
  title: string
  description: string
  ifIgnored: string
  status: EventStatus
  gameMinuteStart: number
  gameMinuteEnd: number | null
  sceneId: string | null
  locationId: string | null
  locationName: string | null
  /** Fichas citadas no título ou na descrição, ligadas sozinhas como nas cenas. */
  entities: { id: string; name: string; kind: EntityKind }[]
}

export interface TimelineEventInput {
  id?: string
  title: string
  description: string
  ifIgnored: string
  status: EventStatus
  gameMinuteStart: number
  gameMinuteEnd: number | null
  sceneId: string | null
  locationId: string | null
}

export interface TimelineData {
  scenes: SceneSummary[]
  events: TimelineEvent[]
}

export const ATTACHMENT_KINDS = ['imagem', 'pdf', 'token', 'mapa', 'outro'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

export interface Attachment {
  id: string
  kind: AttachmentKind
  fileName: string
  relPath: string
  mime: string
  sizeBytes: number
  /** Endereço seguro para <img>: magistrado://anexo/<id> */
  url: string
}

/** Onde um arquivo é usado: cena (com página do PDF), retrato de ficha, imagem de pista, quadro, capa. */
export interface AttachmentUse {
  type: 'scene' | 'entity' | 'clue' | 'board' | 'campaign'
  id: string
  title: string
  pdfPage?: number | null
}

export interface AttachmentDetail extends Attachment {
  createdAt: string
  usedIn: AttachmentUse[]
}

export interface ImportResult {
  imported: Attachment[]
  /** Arquivos que já estavam na campanha (mesmo conteúdo): reaproveitados, sem cópia nova. */
  reused: Attachment[]
  errors: { file: string; message: string }[]
}

export interface SceneAttachment {
  attachment: Attachment
  pdfPage: number | null
}

export interface GameSession {
  id: string
  number: number
  /** Data real em que a mesa jogou, 'YYYY-MM-DD'. */
  playedOn: string | null
}

export interface GameSessionDetail extends GameSession {
  /** Hora no jogo em que a sessão começou (o relógio quando ela foi criada). */
  gameMinuteStart: number | null
  /** Notas rápidas da mesa, JSON do editor. */
  notes: string | null
}

export interface Clue {
  id: string
  title: string
  description: string
  /** O que a pista prova. Só o mestre vê. */
  reveals: string
  status: ClueStatus
  image: Attachment | null
  plannedSceneId: string | null
  plannedSceneTitle: string | null
  locationId: string | null
  locationName: string | null
  foundGameMinute: number | null
  foundSessionId: string | null
  foundSessionNumber: number | null
  finders: { id: string; name: string }[]
  /** Fichas citadas no título, na descrição ou no que revela. */
  links: { id: string; name: string; kind: EntityKind }[]
}

export interface ClueInput {
  id?: string
  title: string
  description: string
  reveals: string
  status: ClueStatus
  imageId: string | null
  plannedSceneId: string | null
  locationId: string | null
  foundGameMinute: number | null
  foundSessionId: string | null
  finderIds: string[]
}

export const BOARD_NODE_TYPES = ['card', 'entity', 'clue', 'scene', 'image', 'text'] as const
export type BoardNodeType = (typeof BOARD_NODE_TYPES)[number]

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface BoardSummary {
  id: string
  name: string
  nodeCount: number
}

/** O que um nó ligado mostra. `missing` quando a ficha, pista ou cena foi para a lixeira. */
export interface BoardNodeRef {
  title: string
  subtitle: string
  kind?: EntityKind
  isPlayer?: boolean
  clueStatus?: ClueStatus
  gameMinute?: number | null
  imageUrl?: string | null
  missing: boolean
}

export interface BoardNode {
  id: string
  type: BoardNodeType
  entityId: string | null
  clueId: string | null
  sceneId: string | null
  attachmentId: string | null
  content: string
  color: string | null
  x: number
  y: number
  w: number | null
  h: number | null
  ref: BoardNodeRef | null
}

export type BoardNodeInput = Omit<BoardNode, 'ref'>

export interface BoardEdge {
  id: string
  from: string
  to: string
  label: string
}

export interface Board {
  id: string
  name: string
  viewport: Viewport
  nodes: BoardNode[]
  edges: BoardEdge[]
}

/** Salva o quadro inteiro de uma vez, numa transação: o que não vier é apagado. */
export interface BoardSave {
  id: string
  name: string
  viewport: Viewport
  nodes: BoardNodeInput[]
  edges: BoardEdge[]
}

export interface MentionTargetDTO {
  id: string
  name: string
  aliases: string[]
  kind: EntityKind
}

export type SearchRefType = 'entity' | 'scene' | 'clue' | 'document' | 'session' | 'event'

export interface SearchResult {
  refType: SearchRefType
  refId: string
  title: string
  snippet: string
  kind?: EntityKind
}

/** O que o preload expõe em window.api. Cada função vira um canal IPC com o mesmo nome. */
export interface Api {
  campaign: {
    recent(): Promise<RecentCampaign[]>
    create(input: { name: string; epochDate: string; example?: boolean }): Promise<Campaign>
    open(path: string): Promise<Campaign>
    pickAndOpen(): Promise<Campaign | null>
    current(): Promise<Campaign | null>
    counts(): Promise<CampaignCounts>
    close(): Promise<void>
    reveal(): Promise<void>
    update(input: CampaignUpdate): Promise<Campaign>
    /** Ações na biblioteca, com a campanha fechada. */
    renameRecent(input: { path: string; name: string }): Promise<void>
    revealRecent(path: string): Promise<void>
    backupRecent(path: string): Promise<string>
    /** Manda a pasta para a Lixeira do Windows e tira da lista. */
    trashRecent(path: string): Promise<void>
  }
  documents: {
    list(): Promise<DocumentSummary[]>
    get(id: string): Promise<TextDocument>
    save(input: DocumentInput): Promise<TextDocument>
    trash(id: string): Promise<void>
  }
  backup: {
    config(): Promise<BackupConfig>
    setConfig(input: Omit<BackupConfig, 'dir'>): Promise<BackupConfig>
    /** Abre a janela de escolher pasta; null se cancelar. */
    pickDir(): Promise<BackupConfig | null>
    now(): Promise<BackupEntry>
    list(): Promise<BackupEntry[]>
    reveal(file: string): Promise<void>
    /** Escolhe um .magistrado-backup, restaura como campanha nova e abre. null se cancelar. */
    pickAndRestore(): Promise<Campaign | null>
  }
  history: {
    /** O que o próximo Ctrl+Z desfaz e o que o Ctrl+Y refaz (ou null). */
    state(): Promise<{ undo: string | null; redo: string | null }>
    undo(): Promise<HistoryResult>
    redo(): Promise<HistoryResult>
  }
  structures: {
    list(): Promise<StructureTemplate[]>
    /** Cria as cenas do modelo; devolve quantas. */
    apply(id: string): Promise<number>
    /** Salva as cenas da campanha aberta como modelo seu. */
    save(name: string): Promise<StructureTemplate>
    remove(id: string): Promise<void>
  }
  export: {
    /** Abre a janela de salvar e gera o arquivo (ou a pasta, no Obsidian). Devolve o caminho, ou null se cancelar. */
    run(input: ExportOptions & { format: ExportFormat }): Promise<string | null>
    reveal(path: string): Promise<void>
  }
  trash: {
    list(): Promise<TrashItem[]>
    restore(input: { type: TrashType; id: string }): Promise<void>
    /** Apaga de vez. Não volta. */
    purge(input: { type: TrashType; id: string }): Promise<void>
  }
  templates: {
    list(): Promise<SystemTemplate[]>
  }
  entities: {
    list(input: { kind?: EntityKind; q?: string }): Promise<EntitySummary[]>
    get(id: string): Promise<EntityDetail>
    save(input: EntityInput): Promise<Entity>
    trash(id: string): Promise<void>
    mentionTargets(): Promise<MentionTargetDTO[]>
    /** Acervo: as fichas de outra campanha da lista, para escolher quais trazer. */
    peekOther(path: string): Promise<EntitySummary[]>
    importFrom(input: { path: string; ids: string[] }): Promise<{ imported: number; skipped: string[] }>
  }
  scenes: {
    saveNote(input: { id?: string; sceneId: string; title: string; body: string }): Promise<SceneNote>
    deleteNote(id: string): Promise<void>
    /** Ordem do corkboard (ordem de planejamento), independente da hora no jogo. */
    reorder(ids: string[]): Promise<void>
    attach(input: { sceneId: string; attachmentId: string; pdfPage: number | null }): Promise<Scene>
    detach(input: { sceneId: string; attachmentId: string }): Promise<Scene>
    list(): Promise<SceneSummary[]>
    get(id: string): Promise<Scene>
    save(input: SceneInput): Promise<Scene>
    trash(id: string): Promise<void>
  }
  clock: {
    set(minute: number): Promise<Campaign>
    advance(minutes: number): Promise<Campaign>
  }
  timeline: {
    list(): Promise<TimelineData>
  }
  events: {
    get(id: string): Promise<TimelineEvent>
    save(input: TimelineEventInput): Promise<TimelineEvent>
    trash(id: string): Promise<void>
  }
  attachments: {
    /** Abre a janela de escolher arquivo; null se cancelar. */
    pickImage(): Promise<Attachment | null>
    importPath(path: string): Promise<Attachment>
    /** Vários arquivos de uma vez (PDF, imagens, tokens); o que falhar não impede o resto. */
    pickFiles(): Promise<ImportResult | null>
    importPaths(paths: string[]): Promise<ImportResult>
    list(): Promise<AttachmentDetail[]>
    get(id: string): Promise<AttachmentDetail>
    setKind(input: { id: string; kind: AttachmentKind }): Promise<AttachmentDetail>
    /** Abre no programa padrão do computador (ex.: o leitor de PDF). */
    openExternal(id: string): Promise<void>
  }
  /** Caminho no disco de um arquivo solto na janela (arrastar e soltar). */
  pathForFile(file: File): string
  sessions: {
    list(): Promise<GameSession[]>
    create(input: { playedOn: string | null }): Promise<GameSession>
    get(id: string): Promise<GameSessionDetail>
    saveNotes(input: { id: string; notes: string | null }): Promise<void>
  }
  clues: {
    list(): Promise<Clue[]>
    get(id: string): Promise<Clue>
    save(input: ClueInput): Promise<Clue>
    trash(id: string): Promise<void>
  }
  boards: {
    list(): Promise<BoardSummary[]>
    create(name: string): Promise<Board>
    get(id: string): Promise<Board>
    save(input: BoardSave): Promise<Board>
    trash(id: string): Promise<void>
  }
  search: {
    query(input: { q: string; limit?: number }): Promise<SearchResult[]>
  }
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }
