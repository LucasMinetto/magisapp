import type { DB } from './db'
import { newId, nowIso } from './db'
import type { BoardNodeInput, BoardNodeType, EntityKind } from '../shared/types'
import { fromParts } from '../shared/gameTime'
import type { CampaignStore } from './store'

// Modelo de ficha Ordem Paranormal: só os nomes dos campos e das escolhas do sistema, nada de texto dos livros.
// Conferido com o livro básico e com Sobrevivendo ao Horror (classe Sobrevivente, estágio, Determinação).
type FieldSeed = [key: string, label: string, type: string, group: string, options?: object]

const ATTRIBUTES = (group: string): FieldSeed[] => [
  ['agi', 'AGI', 'number', group],
  ['for', 'FOR', 'number', group],
  ['int', 'INT', 'number', group],
  ['pre', 'PRE', 'number', group],
  ['vig', 'VIG', 'number', group]
]

const PERSON: FieldSeed[] = [
  ['nex', 'NEX', 'text', 'Geral'],
  // "Mundano" fica para NPCs sem classe; o Sobrevivente é a classe de Sobrevivendo ao Horror.
  ['classe', 'Classe', 'select', 'Geral', { choices: ['Combatente', 'Especialista', 'Ocultista', 'Sobrevivente', 'Mundano'] }],
  ['origem', 'Origem', 'text', 'Geral'],
  ['trilha', 'Trilha', 'text', 'Geral'],
  ['patente', 'Patente', 'select', 'Geral', { choices: ['Recruta', 'Operador', 'Agente especial', 'Oficial de operações', 'Agente de elite'] }],
  ['pv', 'PV', 'resource', 'Recursos'],
  ['pe', 'PE', 'resource', 'Recursos'],
  ['san', 'SAN', 'resource', 'Recursos'],
  ['defesa', 'Defesa', 'number', 'Recursos'],
  ['deslocamento', 'Deslocamento', 'text', 'Recursos'],
  ...ATTRIBUTES('Atributos'),
  ['pericias', 'Perícias', 'list', 'Habilidades'],
  ['rituais', 'Rituais', 'list', 'Habilidades'],
  ['inventario', 'Inventário', 'list', 'Habilidades'],
  // Regras opcionais: a ficha só mostra quando você pede ou quando já têm valor.
  ['estagio', 'Estágio', 'number', 'Sobrevivendo ao Horror', { optional: true }],
  ['pd', 'PD (Determinação)', 'resource', 'Sobrevivendo ao Horror', { optional: true }]
]

const CREATURE: FieldSeed[] = [
  ['vd', 'VD', 'text', 'Geral'],
  ['elemento', 'Elemento', 'select', 'Geral', { choices: ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'] }],
  ['tamanho', 'Tamanho', 'select', 'Geral', { choices: ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'] }],
  ['presenca', 'Presença perturbadora', 'text', 'Geral'],
  ['pv', 'PV', 'resource', 'Combate'],
  ['defesa', 'Defesa', 'number', 'Combate'],
  ['deslocamento', 'Deslocamento', 'text', 'Combate'],
  ['percepcao', 'Percepção', 'text', 'Combate'],
  ['iniciativa', 'Iniciativa', 'text', 'Combate'],
  ['fortitude', 'Fortitude', 'text', 'Combate'],
  ['reflexos', 'Reflexos', 'text', 'Combate'],
  ['vontade', 'Vontade', 'text', 'Combate'],
  ...ATTRIBUTES('Atributos'),
  ['resistencias', 'Resistências', 'list', 'Habilidades'],
  ['imunidades', 'Imunidades', 'list', 'Habilidades'],
  ['vulnerabilidades', 'Vulnerabilidades', 'list', 'Habilidades'],
  ['acoes', 'Ações', 'list', 'Habilidades']
]

const ORDEM = 'Ordem Paranormal'

/**
 * Deixa o modelo embutido igual ao código: cria campos novos e atualiza nome, grupo e ordem dos existentes.
 * Roda ao abrir qualquer campanha; os valores já preenchidos nas fichas ficam onde estão (a chave não muda).
 */
export function syncOrdemTemplate(db: DB): void {
  const t = db.prepare('select id from system_templates where builtin = 1 and name = ?').get(ORDEM) as { id: string } | undefined
  if (!t) return
  const now = nowIso()
  const upsert = db.prepare(
    `insert into template_fields (id, template_id, entity_kind, key, label, type, group_name, options, sort, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (template_id, entity_kind, key) do update set
       label = excluded.label, type = excluded.type, group_name = excluded.group_name, options = excluded.options, sort = excluded.sort,
       updated_at = excluded.updated_at
     where label <> excluded.label or type <> excluded.type or group_name <> excluded.group_name or options <> excluded.options or sort <> excluded.sort`
  )
  const sync = (kind: EntityKind, fields: FieldSeed[]) =>
    fields.forEach(([key, label, type, group, options], i) => upsert.run(newId(), t.id, kind, key, label, type, group, JSON.stringify(options ?? {}), i, now, now))
  db.transaction(() => {
    sync('personagem', PERSON)
    sync('criatura', CREATURE)
  })()
}

export function seedOrdemTemplate(db: DB): string {
  const id = newId()
  const now = nowIso()
  db.prepare('insert into system_templates (id, name, builtin, created_at, updated_at) values (?, ?, 1, ?, ?)').run(id, ORDEM, now, now)
  syncOrdemTemplate(db)
  return id
}

// Campanha de exemplo para ver as telas com dados. Texto original, escrito para este app.
export interface ExampleSeed {
  entities: {
    key: string
    kind: EntityKind
    name: string
    role: string
    isPlayer?: boolean
    aliases?: string[]
    stats?: object
    description?: string
    custom?: { label: string; value: string }[]
  }[]
  scenes: { title: string; start: string; end: string; location: string; paragraphs: string[]; status?: string }[]
  events: { title: string; date: string; time: string; description: string; ifIgnored?: string; location?: string; status?: string }[]
  clues: { title: string; description: string; reveals: string; location: string; scene: string; found?: { time: string; by: string[] } }[]
}

export const EXAMPLE: ExampleSeed = {
  entities: [
    { key: 'lia', kind: 'personagem', name: 'Lia Moraes', role: 'Agente, ocultista', isPlayer: true, stats: { nex: '15%', classe: 'Ocultista', pv: { current: 14, max: 14 }, san: { current: 20, max: 20 } } },
    { key: 'tomas', kind: 'personagem', name: 'Tomás Andrade', role: 'Agente, combatente', isPlayer: true, stats: { nex: '15%', classe: 'Combatente', pv: { current: 24, max: 24 }, san: { current: 12, max: 12 } } },
    {
      key: 'aurelio',
      kind: 'personagem',
      name: 'Dr. Aurélio Bastos',
      role: 'Diretor do hospital',
      aliases: ['Aurélio', 'o diretor'],
      stats: { nex: '—', classe: 'Mundano', pv: { current: 18, max: 24 }, san: { current: 6, max: 20 }, agi: 1, for: 1, int: 3, pre: 2, vig: 1 },
      description: 'Fala baixo, nunca encara ninguém. Esconde as chaves da ala fechada no bolso do jaleco.',
      custom: [
        { label: 'Deve favor a', value: 'Ninguém na cidade sabe; o hospital só não fechou por causa dele.' },
        { label: 'Se pressionado', value: 'Chora, depois mente sobre o domingo.' }
      ]
    },
    { key: 'vigia', kind: 'criatura', name: 'A Vigia', role: 'Criatura de Morte na ala fechada', aliases: ['Vigia'], stats: { elemento: 'Morte', vd: '40', pv: { current: 60, max: 60 }, defesa: 18 } },
    { key: 'hospital', kind: 'local', name: 'Hospital Santa Clara', role: 'Hospital fechado pela metade', aliases: ['Santa Clara', 'hospital'] },
    { key: 'sede', kind: 'local', name: 'Escritório da Ordem', role: 'Onde os agentes recebem o caso' }
  ],
  scenes: [
    {
      title: 'Chamado da Ordem',
      start: '19:00',
      end: '20:00',
      location: 'sede',
      status: 'jogada',
      paragraphs: [
        'Os agentes recebem uma pasta fina: um enfermeiro sumiu do Hospital Santa Clara há três dias e ninguém registrou queixa.',
        'Lia Moraes nota que a última assinatura do enfermeiro no livro de ponto foi às 21h58 de domingo.'
      ]
    },
    {
      title: 'Ala fechada',
      start: '23:10',
      end: '23:59',
      location: 'hospital',
      paragraphs: [
        'O corredor cheira a cloro e ferrugem. Dr. Aurélio Bastos espera junto à porta da ala, sem olhar nos olhos de ninguém.',
        'Se os agentes chegarem depois da meia-noite, a Vigia já está do lado de dentro.'
      ]
    }
  ],
  // Datas relativas ao dia do caso (22/07): -3 = domingo, 19/07.
  events: [
    {
      title: 'Último ponto do enfermeiro',
      date: '-3',
      time: '21:58',
      description: 'A última assinatura no livro de ponto do Hospital Santa Clara. Depois disso, ninguém o viu.',
      location: 'hospital',
      status: 'aconteceu'
    },
    {
      title: 'A Vigia cruza a porta da ala',
      date: '+1',
      time: '00:00',
      description: 'À meia-noite a criatura deixa o porão e sobe para a ala fechada.',
      ifIgnored: 'Quem estiver na ala sem proteção vira o próximo sumido.',
      location: 'hospital'
    },
    {
      title: 'O diretor queima o livro de ponto',
      date: '+1',
      time: '02:30',
      description: 'Dr. Aurélio Bastos leva o livro para a caldeira.',
      ifIgnored: 'A pista da assinatura das 21h58 se perde.',
      location: 'hospital'
    }
  ],
  // A sessão 1 jogou só a primeira cena; a primeira pista saiu dela.
  clues: [
    {
      title: 'Cópia do livro de ponto',
      description: 'Folha xerocada na pasta do caso. A última assinatura do enfermeiro é das 21h58 de domingo.',
      reveals: 'Ele sumiu dentro do hospital, depois do turno, e alguém deixou o ponto em aberto.',
      location: 'sede',
      scene: 'Chamado da Ordem',
      found: { time: '19:40', by: ['lia'] }
    },
    {
      title: 'Chave da ala fechada',
      description: 'Chave de latão com etiqueta azul, no bolso do jaleco do Dr. Aurélio Bastos.',
      reveals: 'O diretor entra na ala quando quer: ele sabe o que tem lá dentro.',
      location: 'hospital',
      scene: 'Ala fechada'
    },
    {
      title: 'Arranhões na porta da ala',
      description: 'Riscos fundos por dentro da porta, rente ao chão.',
      reveals: 'Algo tentou sair. A porta não segura a Vigia por muito tempo.',
      location: 'hospital',
      scene: 'Ala fechada'
    }
  ]
}

export function paragraphsDoc(paragraphs: string[]): string {
  return JSON.stringify({
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
  })
}

/** Linha única de campaign + modelo Ordem Paranormal. O relógio começa às 19h do dia do caso. */
export function initCampaignRow(db: DB, name: string, epochDate: string): void {
  const templateId = seedOrdemTemplate(db)
  const now = nowIso()
  db.prepare(
    'insert into campaign (id, name, system_template_id, epoch_date, current_game_minute, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
  ).run(newId(), name, templateId, epochDate, 19 * 60, now, now)
}

export function seedExample(store: CampaignStore): void {
  const { epochDate } = store.campaign()
  const ids = new Map<string, string>()
  for (const e of EXAMPLE.entities) {
    const saved = store.saveEntity({
      kind: e.kind,
      name: e.name,
      role: e.role,
      isPlayer: e.isPlayer ?? false,
      aliases: e.aliases ?? [],
      stats: (e.stats ?? {}) as never,
      description: e.description ?? '',
      personality: '',
      portraitId: null,
      customAttributes: e.custom ?? []
    })
    ids.set(e.key, saved.id)
  }
  const sceneIds = new Map<string, string>()
  for (const s of EXAMPLE.scenes) {
    const saved = store.saveScene({
      title: s.title,
      summary: '',
      body: paragraphsDoc(s.paragraphs),
      status: (s.status as 'jogada') ?? 'planejada',
      locationId: ids.get(s.location) ?? null,
      gameMinuteStart: fromParts(epochDate, epochDate, s.start),
      gameMinuteEnd: fromParts(epochDate, epochDate, s.end)
    })
    sceneIds.set(s.title, saved.id)
  }
  for (const e of EXAMPLE.events) {
    store.saveEvent({
      title: e.title,
      description: e.description,
      ifIgnored: e.ifIgnored ?? '',
      status: (e.status as 'aconteceu') ?? 'planejado',
      gameMinuteStart: Number(e.date) * 1440 + (fromParts(epochDate, epochDate, e.time) ?? 0),
      gameMinuteEnd: null,
      sceneId: null,
      locationId: e.location ? (ids.get(e.location) ?? null) : null
    })
  }
  const session = store.createSession('2026-10-25')
  const clueIds = new Map<string, string>()
  for (const c of EXAMPLE.clues) {
    const saved = store.saveClue({
      title: c.title,
      description: c.description,
      reveals: c.reveals,
      status: c.found ? 'achada' : 'oculta',
      imageId: null,
      plannedSceneId: sceneIds.get(c.scene) ?? null,
      locationId: ids.get(c.location) ?? null,
      foundGameMinute: c.found ? fromParts(epochDate, epochDate, c.found.time) : null,
      foundSessionId: c.found ? session.id : null,
      finderIds: c.found ? c.found.by.map((k) => ids.get(k)!) : []
    })
    clueIds.set(c.title, saved.id)
  }

  // Quadro de exemplo: o mapa mental do caso, do jeito que se monta antes da sessão.
  const board = store.createBoard('O caso')
  const node = (type: BoardNodeType, x: number, y: number, refs: Partial<BoardNodeInput> = {}): BoardNodeInput => ({
    id: newId(),
    type,
    entityId: null,
    clueId: null,
    sceneId: null,
    attachmentId: null,
    content: '',
    color: null,
    x,
    y,
    w: null,
    h: null,
    ...refs
  })
  const question = node('card', 0, 0, { content: 'Quem deixou o ponto do enfermeiro em aberto?' })
  const aurelio = node('entity', 320, -40, { entityId: ids.get('aurelio') })
  const vigia = node('entity', 320, 220, { entityId: ids.get('vigia') })
  const hospital = node('entity', 640, 90, { entityId: ids.get('hospital') })
  const chave = node('clue', 0, 160, { clueId: clueIds.get('Chave da ala fechada') })
  const arranhoes = node('clue', 0, 330, { clueId: clueIds.get('Arranhões na porta da ala') })
  const ala = node('scene', 640, 280, { sceneId: sceneIds.get('Ala fechada') })
  const nodes = [question, aurelio, vigia, hospital, chave, arranhoes, ala]
  const edge = (from: BoardNodeInput, to: BoardNodeInput, label = '') => ({ id: newId(), from: from.id, to: to.id, label })
  store.saveBoard({
    id: board.id,
    name: board.name,
    viewport: board.viewport,
    nodes,
    edges: [
      edge(question, aurelio, 'suspeito'),
      edge(chave, aurelio, 'está com ele'),
      edge(arranhoes, vigia),
      edge(aurelio, hospital, 'dirige'),
      edge(vigia, ala, 'à meia-noite'),
      edge(ala, hospital)
    ]
  })
}
