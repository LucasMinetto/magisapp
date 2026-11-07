// Biblioteca única: ameaças, itens e rituais compartilhados por todas as campanhas.
// Banco próprio (biblioteca.sqlite na pasta de dados do app), com migrações e backup próprios.
// Cada registro tem uma origem (livro oficial, "Criações próprias", outro livro). Usar numa campanha
// COPIA o registro: a campanha continua funcionando sem a biblioteca (backup, outro PC).
// Sem Electron aqui: dá para testar com vitest.
import Database from 'better-sqlite3'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { z } from 'zod'
import { newId, nowIso, type DB } from './db'
import { BACKUP_EXT } from './backup'
import type { CampaignStore } from './store'
import {
  ameacaBibliotecaSchema,
  fichaAgenteSchema,
  itemBibliotecaSchema,
  ritualBibliotecaSchema,
  type BlocoAmeaca,
  type Item,
  type Origem,
  type RitualDaFicha
} from '../shared/ordem/esquemas'
import type { LivroDados } from './livros'
import { itemParaFicha, origemDe, ritualParaFicha } from '../shared/ordem/biblioteca'
import { arquivoDoToken, guardarToken, imagensDaPasta, parear } from './tokens'
import type { Entity, LibraryDataByKind, LibraryEntry, LibraryKind, LibrarySource, SourceKind } from '../shared/types'

export const LIBRARY_VERSION = 2
export const OWN_SOURCE_NAME = 'Criações próprias'

/** Migração n leva a biblioteca da versão n-1 para n (pragma user_version). */
const MIGRATIONS: Record<number, string> = {
  1: `create table sources (
        id            text primary key,
        name          text not null,
        kind          text not null check (kind in ('oficial','propria','outro')),
        abbreviation  text not null default '',
        builtin       integer not null default 0 check (builtin in (0, 1)),
        created_at    text not null,
        updated_at    text not null
      );
      create unique index sources_name on sources (name collate nocase);
      create table lib_threats (
        id text primary key, source_id text not null references sources(id), name text not null,
        data text not null default '{}', created_at text not null, updated_at text not null
      );
      create table lib_items (
        id text primary key, source_id text not null references sources(id), name text not null,
        data text not null default '{}', created_at text not null, updated_at text not null
      );
      create table lib_rituals (
        id text primary key, source_id text not null references sources(id), name text not null,
        data text not null default '{}', created_at text not null, updated_at text not null
      );
      create index lib_threats_source on lib_threats (source_id, name);
      create index lib_items_source on lib_items (source_id, name);
      create index lib_rituals_source on lib_rituals (source_id, name);`,
  // 2: guarda até qual versão dos dados dos livros a biblioteca já recebeu.
  2: `create table meta (key text primary key, value text not null);`
}

const TABLE: Record<LibraryKind, string> = { ameaca: 'lib_threats', item: 'lib_items', ritual: 'lib_rituals' }
const SCHEMA: { [K in LibraryKind]: z.ZodType<LibraryDataByKind[K]> } = {
  ameaca: ameacaBibliotecaSchema,
  item: itemBibliotecaSchema,
  ritual: ritualBibliotecaSchema
}

interface SourceRow {
  id: string
  name: string
  kind: SourceKind
  abbreviation: string
  builtin: number
  count: number
}

interface EntryRow {
  id: string
  source_id: string
  source_name: string
  name: string
  data: string
  updated_at: string
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function openLibraryDb(file: string): DB {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  const v = db.pragma('user_version', { simple: true }) as number
  if (v > LIBRARY_VERSION) {
    db.close()
    throw new Error('A biblioteca foi criada numa versão mais nova do app. Atualize o app para abrir.')
  }
  if (v < LIBRARY_VERSION) {
    if (v > 0) db.exec(`vacuum into '${`${file}.v${v}.bak`.replaceAll("'", "''")}'`)
    db.transaction(() => {
      for (let n = v + 1; n <= LIBRARY_VERSION; n++) db.exec(MIGRATIONS[n])
      db.pragma(`user_version = ${LIBRARY_VERSION}`)
    })()
  }
  if (!db.prepare('select 1 from sources where builtin = 1').get()) {
    const now = nowIso()
    db.prepare("insert into sources (id, name, kind, builtin, created_at, updated_at) values (?, ?, 'propria', 1, ?, ?)").run(newId(), OWN_SOURCE_NAME, now, now)
  }
  return db
}

export class LibraryStore {
  db: DB

  /** `livros`: dados dos livros oficiais para semear (o app passa os de src/main/livros; os testes, nada). */
  constructor(
    readonly file: string,
    private readonly livros: { dados: LivroDados[]; versao: number } = { dados: [], versao: 0 }
  ) {
    this.db = openLibraryDb(file)
    this.semear()
  }

  /** Pasta das imagens dos tokens, ao lado do banco. */
  get tokensDir(): string {
    return join(dirname(this.file), 'biblioteca-tokens')
  }

  tokenFile(nome: string): string | null {
    return arquivoDoToken(this.tokensDir, nome)
  }

  /** Põe (ou tira, com null) o token de uma ameaça. */
  setToken(id: string, src: string | null): LibraryEntry<'ameaca'> {
    const e = this.get('ameaca', id)
    const token = src ? guardarToken(this.tokensDir, src) : ''
    return this.save('ameaca', { id, sourceId: e.sourceId, data: { ...e.data, token } })
  }

  /**
   * Liga as imagens de uma pasta (e subpastas) às ameaças de nome parecido. Não troca token que a ameaça já tem.
   * Devolve quem recebeu imagem e as imagens que não acharam ameaça.
   */
  importTokens(dir: string): { ligados: string[]; sobras: string[]; jaTinham: number } {
    const ameacas = this.list('ameaca')
    const { ligados, sobras } = parear(
      ameacas.map((a) => ({ id: a.id, nome: a.name })),
      imagensDaPasta(dir)
    )
    const nomes: string[] = []
    let jaTinham = 0
    this.db.transaction(() => {
      for (const a of ameacas) {
        const img = ligados.get(a.id)
        if (!img) continue
        if (a.data.token && this.tokenFile(a.data.token)) {
          jaTinham++
          continue
        }
        this.setToken(a.id, img.arquivo)
        nomes.push(a.name)
      }
    })()
    return { ligados: nomes.sort((x, y) => x.localeCompare(y)), sobras: sobras.map((i) => i.arquivo.slice(dir.length + 1)), jaTinham }
  }

  /**
   * Acrescenta os registros dos livros que ainda não estão na biblioteca, uma vez por versão dos dados.
   * Usa ids fixos: o que o mestre editou fica como está; o que apagou só volta quando a versão dos dados subir.
   */
  semear(): void {
    const { dados, versao } = this.livros
    if (!dados.length) return
    const atual = Number((this.db.prepare("select value from meta where key = 'livros'").get() as { value: string } | undefined)?.value ?? 0)
    if (atual >= versao) return
    const now = nowIso()
    const tabelas: [keyof Omit<LivroDados, 'fonte'>, LibraryKind][] = [
      ['ameacas', 'ameaca'],
      ['itens', 'item'],
      ['rituais', 'ritual']
    ]
    this.db.transaction(() => {
      for (const livro of dados) {
        const porNome = this.db.prepare('select id from sources where name = ? collate nocase').get(livro.fonte.nome) as { id: string } | undefined
        const sourceId = porNome?.id ?? `livro-${livro.fonte.sigla.toLowerCase()}`
        if (!porNome) {
          this.db
            .prepare("insert into sources (id, name, kind, abbreviation, created_at, updated_at) values (?, ?, 'oficial', ?, ?, ?)")
            .run(sourceId, livro.fonte.nome, livro.fonte.sigla, now, now)
        }
        for (const [campo, kind] of tabelas) {
          const ins = this.db.prepare(`insert or ignore into ${TABLE[kind]} (id, source_id, name, data, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`)
          for (const r of livro[campo]) {
            const { id, ...resto } = r
            const parsed = SCHEMA[kind].safeParse(resto)
            if (!parsed.success) continue
            ins.run(id, sourceId, parsed.data.nome, JSON.stringify(parsed.data), now, now)
          }
        }
      }
      this.db.prepare("insert into meta (key, value) values ('livros', ?) on conflict(key) do update set value = excluded.value").run(String(versao))
    })()
  }

  close(): void {
    this.db.close()
  }

  // ------------------------------------------------------------ origens

  sources(): LibrarySource[] {
    const counts = Object.values(TABLE)
      .map((t) => `(select count(*) from ${t} where source_id = s.id)`)
      .join(' + ')
    const rows = this.db.prepare(`select s.*, ${counts} as count from sources s order by s.builtin desc, s.name collate nocase`).all() as SourceRow[]
    return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, abbreviation: r.abbreviation, builtin: r.builtin === 1, count: r.count }))
  }

  ownSourceId(): string {
    return (this.db.prepare('select id from sources where builtin = 1').get() as { id: string }).id
  }

  saveSource(input: { id?: string; name: string; kind: SourceKind; abbreviation: string }): LibrarySource {
    const name = input.name.trim()
    if (!name) throw new Error('Dê um nome para a origem.')
    const clash = this.db.prepare('select id from sources where name = ? collate nocase').get(name) as { id: string } | undefined
    if (clash && clash.id !== input.id) throw new Error(`Já existe a origem "${name}".`)
    const now = nowIso()
    const id = input.id ?? newId()
    if (input.id) {
      const old = this.db.prepare('select builtin from sources where id = ?').get(input.id) as { builtin: number } | undefined
      if (!old) throw new Error('Origem não encontrada.')
      // A embutida continua sendo "própria": só o nome e a sigla mudam.
      const kind = old.builtin ? 'propria' : input.kind
      this.db.prepare('update sources set name = ?, kind = ?, abbreviation = ?, updated_at = ? where id = ?').run(name, kind, input.abbreviation.trim(), now, id)
    } else {
      this.db
        .prepare('insert into sources (id, name, kind, abbreviation, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
        .run(id, name, input.kind, input.abbreviation.trim(), now, now)
    }
    return this.sources().find((s) => s.id === id)!
  }

  /** Só apaga origem vazia e que não seja a embutida: nada fica sem origem. */
  deleteSource(id: string): void {
    const s = this.sources().find((x) => x.id === id)
    if (!s) throw new Error('Origem não encontrada.')
    if (s.builtin) throw new Error(`"${s.name}" vem com o app e não pode ser apagada.`)
    if (s.count > 0) throw new Error(`"${s.name}" ainda tem ${s.count} registro(s). Mude a origem deles ou apague-os antes.`)
    this.db.prepare('delete from sources where id = ?').run(id)
  }

  // ------------------------------------------------------------ registros

  list<K extends LibraryKind>(kind: K, filter: { sourceId?: string; q?: string } = {}): LibraryEntry<K>[] {
    const where: string[] = []
    const args: unknown[] = []
    if (filter.sourceId) {
      where.push('e.source_id = ?')
      args.push(filter.sourceId)
    }
    const rows = this.db
      .prepare(
        `select e.*, s.name as source_name from ${TABLE[kind]} e join sources s on s.id = e.source_id
         ${where.length ? `where ${where.join(' and ')}` : ''} order by e.name collate nocase`
      )
      .all(...args) as EntryRow[]
    const needle = filter.q?.trim() ? fold(filter.q.trim()) : null
    return rows.filter((r) => !needle || fold(r.name).includes(needle)).map((r) => this.entry(kind, r))
  }

  get<K extends LibraryKind>(kind: K, id: string): LibraryEntry<K> {
    const r = this.db.prepare(`select e.*, s.name as source_name from ${TABLE[kind]} e join sources s on s.id = e.source_id where e.id = ?`).get(id) as
      | EntryRow
      | undefined
    if (!r) throw new Error('Registro não encontrado na biblioteca.')
    return this.entry(kind, r)
  }

  save<K extends LibraryKind>(kind: K, input: { id?: string; sourceId: string; data: unknown }): LibraryEntry<K> {
    const data = SCHEMA[kind].parse(input.data) as LibraryDataByKind[K]
    if (!this.db.prepare('select 1 from sources where id = ?').get(input.sourceId)) throw new Error('Escolha uma origem que exista.')
    const now = nowIso()
    const id = input.id ?? newId()
    const json = JSON.stringify(data)
    const exists = input.id && this.db.prepare(`select 1 from ${TABLE[kind]} where id = ?`).get(input.id)
    if (exists) {
      this.db.prepare(`update ${TABLE[kind]} set source_id = ?, name = ?, data = ?, updated_at = ? where id = ?`).run(input.sourceId, data.nome, json, now, id)
    } else {
      this.db
        .prepare(`insert into ${TABLE[kind]} (id, source_id, name, data, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`)
        .run(id, input.sourceId, data.nome, json, now, now)
    }
    return this.get(kind, id)
  }

  remove(kind: LibraryKind, id: string): void {
    this.db.prepare(`delete from ${TABLE[kind]} where id = ?`).run(id)
  }

  private entry<K extends LibraryKind>(kind: K, r: EntryRow): LibraryEntry<K> {
    let raw: unknown = {}
    try {
      raw = JSON.parse(r.data)
    } catch {
      // registro estragado: mostra com os padrões em vez de sumir
    }
    const parsed = SCHEMA[kind].safeParse(raw)
    const data = (parsed.success ? parsed.data : SCHEMA[kind].parse({ nome: r.name })) as LibraryDataByKind[K]
    return { id: r.id, kind, sourceId: r.source_id, sourceName: r.source_name, name: r.name, data, updatedAt: r.updated_at }
  }

  // ------------------------------------------------------------ backup

  /** Um arquivo .magistrado-backup só com a biblioteca (biblioteca.sqlite + biblioteca.json legível). */
  backup(dir: string, now = new Date()): string {
    mkdirSync(dir, { recursive: true })
    const p = (n: number) => String(n).padStart(2, '0')
    const base = `Biblioteca ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}h${p(now.getMinutes())}`
    let file = join(dir, `${base}${BACKUP_EXT}`)
    for (let i = 2; existsSync(file); i++) file = join(dir, `${base} ${i}${BACKUP_EXT}`)
    const tmp = join(tmpdir(), `magistrado-bib-${newId()}.sqlite`)
    this.db.exec(`vacuum into '${tmp.replaceAll("'", "''")}'`)
    try {
      const json = {
        app: 'Magistrado',
        biblioteca: LIBRARY_VERSION,
        exportadoEm: now.toISOString(),
        origens: this.sources(),
        ameacas: this.list('ameaca'),
        itens: this.list('item'),
        rituais: this.list('ritual')
      }
      const arquivos: Record<string, Uint8Array> = { 'biblioteca.sqlite': readFileSync(tmp), 'biblioteca.json': strToU8(JSON.stringify(json, null, 1)) }
      for (const a of this.list('ameaca')) {
        const f = a.data.token ? this.tokenFile(a.data.token) : null
        if (f) arquivos[`tokens/${a.data.token}`] = readFileSync(f)
      }
      const zip = zipSync(arquivos, { level: 6 })
      writeFileSync(`${file}.parcial`, zip)
      renameSync(`${file}.parcial`, file)
      return file
    } finally {
      rmSync(tmp, { force: true })
    }
  }

  /**
   * Troca a biblioteca pela do backup. A atual é guardada antes em biblioteca.sqlite.antes-de-restaurar.
   * Se o arquivo não for um backup de biblioteca que abra, nada muda.
   */
  restore(file: string): void {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(readFileSync(file), { filter: (f) => f.name === 'biblioteca.sqlite' || f.name === 'biblioteca.json' || f.name.startsWith('tokens/') })
    } catch {
      throw new Error('Não deu para ler este arquivo. Ele é um backup da biblioteca do Magistrado?')
    }
    if (!entries['biblioteca.sqlite']) {
      const isLibrary = entries['biblioteca.json'] && strFromU8(entries['biblioteca.json']).includes('"biblioteca"')
      throw new Error(isLibrary ? 'O backup da biblioteca está sem o banco.' : 'Este arquivo não é um backup da biblioteca (é de uma campanha?).')
    }
    const tmp = join(tmpdir(), `magistrado-bib-${newId()}.sqlite`)
    writeFileSync(tmp, entries['biblioteca.sqlite'])
    try {
      const check = new Database(tmp, { fileMustExist: true })
      try {
        if (check.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('O banco do backup está corrompido.')
        if (!check.prepare("select 1 from sqlite_master where name = 'sources'").get()) throw new Error('Este arquivo não é um backup da biblioteca.')
        if ((check.pragma('user_version', { simple: true }) as number) > LIBRARY_VERSION) throw new Error('Backup feito numa versão mais nova do app.')
      } finally {
        check.close()
      }
      this.db.exec(`vacuum into '${`${this.file}.antes-de-restaurar.parcial`.replaceAll("'", "''")}'`)
      renameSync(`${this.file}.antes-de-restaurar.parcial`, `${this.file}.antes-de-restaurar`)
      this.db.close()
      for (const f of ['', '-wal', '-shm']) rmSync(`${this.file}${f}`, { force: true })
      copyFileSync(tmp, this.file)
      for (const [nome, dados] of Object.entries(entries)) {
        const base = nome.slice('tokens/'.length)
        if (!nome.startsWith('tokens/') || !/^[a-f0-9]{16}\.[a-z]{3,4}$/.test(base)) continue
        mkdirSync(this.tokensDir, { recursive: true })
        if (!existsSync(join(this.tokensDir, base))) writeFileSync(join(this.tokensDir, base), dados)
      }
    } finally {
      rmSync(tmp, { force: true })
      // Reabre sempre: com o backup novo, ou com a mesma de antes se algo falhou antes de trocar.
      if (!this.db.open) this.db = openLibraryDb(this.file)
    }
    this.semear()
  }
}

// ------------------------------------------------------------ cópia para a campanha

const origem = origemDe

/** Ameaça da biblioteca como ficha da campanha: o nome vai para a ficha, o resto para o bloco. */
export function threatForCampaign(e: LibraryEntry<'ameaca'>): { name: string; sheetData: BlocoAmeaca; origin: Origem; token: string } {
  const { nome, pagina: _pagina, token, ...bloco } = e.data
  return { name: nome, sheetData: bloco, origin: origem(e), token }
}

/** Item da biblioteca no inventário de uma ficha: id novo, um de quantidade, guardado. */
export const itemForSheet = (e: LibraryEntry<'item'>): Item => itemParaFicha(e, newId())

/** Ritual da biblioteca na ficha: id novo e a origem. */
export const ritualForSheet = (e: LibraryEntry<'ritual'>): RitualDaFicha => ritualParaFicha(e, newId())

/** Ameaça vira ficha nova; item e ritual entram na ficha completa escolhida. Sempre uma cópia. */
export function copyToCampaign(store: CampaignStore, lib: LibraryStore, input: { kind: LibraryKind; id: string; entityId?: string }): Entity {
  if (input.kind === 'ameaca') {
    const t = threatForCampaign(lib.get('ameaca', input.id))
    // o token da biblioteca vira o retrato da ficha (uma cópia na campanha)
    const tokenFile = t.token ? lib.tokenFile(t.token) : null
    const portraitId = tokenFile ? store.importFile(tokenFile, { imagesOnly: true }).attachment.id : null
    return store.saveEntity(
      {
        kind: 'ameaca',
        name: t.name,
        role: '',
        isPlayer: false,
        aliases: [],
        stats: {},
        description: '',
        personality: '',
        portraitId,
        customAttributes: [],
        sheetData: t.sheetData
      },
      t.origin
    )
  }
  if (!input.entityId) throw new Error('Escolha a ficha que recebe o item ou o ritual.')
  const target = store.getEntity(input.entityId)
  if (target.kind !== 'personagem' || target.sheet !== 'completa') throw new Error('Itens e rituais entram só em ficha completa (agente ou vilão).')
  const ficha = fichaAgenteSchema.parse(target.sheetData)
  if (input.kind === 'item') ficha.inventario.push(itemForSheet(lib.get('item', input.id)))
  else ficha.rituais.push(ritualForSheet(lib.get('ritual', input.id)))
  return store.saveSheetData(target.id, ficha)
}
