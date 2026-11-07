// Biblioteca única: ameaças, itens e rituais compartilhados por todas as campanhas.
// Banco próprio (biblioteca.sqlite na pasta de dados do app), com migrações e backup próprios.
// Cada registro tem uma origem (livro oficial, "Criações próprias", outro livro). Usar numa campanha
// COPIA o registro: a campanha continua funcionando sem a biblioteca (backup, outro PC).
// Sem Electron aqui: dá para testar com vitest.
import Database from 'better-sqlite3'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { z } from 'zod'
import { newId, nowIso, type DB } from './db'
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
import { arquivoDoToken, guardarToken } from './tokens'
import { LIBRARY_KINDS, type Entity, type ImportChoice, type ImportPreview, type ImportPreviewSource, type PackageImportResult, type LibraryDataByKind, type LibraryEntry, type LibraryKind, type LibrarySource, type SourceKind } from '../shared/types'

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

  /**
   * `livros`: dados dos livros oficiais para semear (o app passa os de src/main/livros; os testes, nada).
   * `livros.tokens`: pasta com as imagens das ameaças dos livros, que vem com o app (só leitura).
   */
  constructor(
    readonly file: string,
    private readonly livros: { dados: LivroDados[]; versao: number; tokens?: string } = { dados: [], versao: 0 }
  ) {
    this.db = openLibraryDb(file)
    this.semear()
  }

  /** Pasta das imagens dos tokens, ao lado do banco. */
  get tokensDir(): string {
    return join(dirname(this.file), 'biblioteca-tokens')
  }

  /** O arquivo de um token: primeiro os do mestre (biblioteca-tokens/), depois os que vêm com o app. */
  tokenFile(nome: string): string | null {
    return arquivoDoToken(this.tokensDir, nome) ?? (this.livros.tokens ? arquivoDoToken(this.livros.tokens, nome) : null)
  }

  /**
   * Põe uma imagem como token principal da ameaça (o anterior vira variante, para não perder a arte do livro),
   * ou tira o principal, com null.
   */
  setToken(id: string, src: string | null): LibraryEntry<'ameaca'> {
    const e = this.get('ameaca', id)
    if (!src) return this.save('ameaca', { id, sourceId: e.sourceId, data: { ...e.data, token: '' } })
    const token = guardarToken(this.tokensDir, src)
    const extras = [e.data.token, ...e.data.tokensExtras].filter((t) => t && t !== token)
    return this.save('ameaca', { id, sourceId: e.sourceId, data: { ...e.data, token, tokensExtras: extras } })
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
            const novo = ins.run(id, sourceId, parsed.data.nome, JSON.stringify(parsed.data), now, now).changes > 0
            if (!novo && kind === 'ameaca') this.darTokensDoLivro(id, parsed.data as LibraryDataByKind['ameaca'])
          }
        }
      }
      this.db.prepare("insert into meta (key, value) values ('livros', ?) on conflict(key) do update set value = excluded.value").run(String(versao))
    })()
  }

  /** Ameaça do livro que já estava na biblioteca, sem token nenhum: recebe os do livro. Não troca o que o mestre escolheu. */
  private darTokensDoLivro(id: string, livro: LibraryDataByKind['ameaca']): void {
    if (!livro.token) return
    const row = this.db.prepare('select data from lib_threats where id = ?').get(id) as { data: string } | undefined
    if (!row) return
    const atual = SCHEMA.ameaca.parse(JSON.parse(row.data)) as LibraryDataByKind['ameaca']
    if (atual.token || atual.tokensExtras.length) return
    const data = { ...atual, token: livro.token, tokensExtras: livro.tokensExtras }
    this.db.prepare('update lib_threats set data = ? where id = ?').run(JSON.stringify(data), id)
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

  // ------------------------------------------------------------ pacote por origem

  /**
   * Pacote (.magistrado-biblioteca, um zip): as origens pedidas com as ameaças, os rituais, os itens e os tokens do
   * mestre. Os tokens dos livros vêm com o app e não entram. Sem `sourceIds`, todas as origens ("exportar tudo").
   */
  exportPackage(file: string, sourceIds?: string[], now = new Date()): string {
    const origens = this.sources().filter((s) => !sourceIds || sourceIds.includes(s.id))
    if (!origens.length) throw new Error('Escolha ao menos uma origem para exportar.')
    const ids = new Set(origens.map((o) => o.id))
    const registros = LIBRARY_KINDS.flatMap((kind) =>
      this.list(kind)
        .filter((e) => ids.has(e.sourceId))
        .map((e) => ({ kind, id: e.id, sourceId: e.sourceId, data: e.data as unknown }))
    )
    const pacote: PacoteJson = {
      app: 'Magistrado',
      pacote: PACOTE_FORMATO,
      exportadoEm: now.toISOString(),
      origens: origens.map(({ id, name, kind, abbreviation }) => ({ id, name, kind, abbreviation })),
      registros
    }
    const arquivos: Record<string, Uint8Array> = { 'biblioteca.json': strToU8(JSON.stringify(pacote, null, 1)) }
    for (const r of registros) {
      if (r.kind !== 'ameaca') continue
      const a = r.data as LibraryDataByKind['ameaca']
      for (const t of [a.token, ...a.tokensExtras]) {
        const f = t ? arquivoDoToken(this.tokensDir, t) : null
        if (f) arquivos[`tokens/${t}`] = readFileSync(f)
      }
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(`${file}.parcial`, zipSync(arquivos, { level: 6 }))
    renameSync(`${file}.parcial`, file) // aparece inteiro ou não aparece
    return file
  }

  /** Pacote com a biblioteca inteira na pasta de backups (o app faz antes de atualizar). */
  backup(dir: string, now = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0')
    const base = `Biblioteca ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}h${p(now.getMinutes())}`
    let file = join(dir, `${base}${PACOTE_EXT}`)
    for (let i = 2; existsSync(file); i++) file = join(dir, `${base} ${i}${PACOTE_EXT}`)
    return this.exportPackage(file, undefined, now)
  }

  /** Compara o pacote com a biblioteca daqui. Não muda nada. */
  previewImport(file: string): ImportPreview {
    const { pacote } = lerPacote(file)
    return { file, origens: pacote.origens.map((o) => this.compararOrigem(pacote, o)) }
  }

  /**
   * Importa o pacote. Origem nova entra como está. Origem que já existe aqui segue a escolha do mestre:
   * "atualizar" troca os registros que mudaram e acrescenta os novos (os que só existem aqui ficam);
   * "copia" cria outra origem, com outro nome, com tudo do pacote. Sem escolha, a origem que já existe não muda.
   */
  importPackage(file: string, choices: Record<string, ImportChoice>): PackageImportResult {
    const { pacote, tokens } = lerPacote(file)
    const result: PackageImportResult = { origens: 0, novos: 0, atualizados: 0 }
    const now = nowIso()
    this.db.transaction(() => {
      for (const o of pacote.origens) {
        const match = this.origemIgual(o)
        const choice: ImportChoice | undefined = match ? choices[o.id] : 'copia'
        if (!choice) continue
        const atualizar = choice === 'atualizar' && match !== null
        let destino: string
        if (atualizar) destino = match.id
        else {
          const idLivre = !match && !this.db.prepare('select 1 from sources where id = ?').get(o.id)
          destino = idLivre ? o.id : newId()
          let name = match ? `${o.name} (cópia)` : o.name
          for (let i = 2; this.db.prepare('select 1 from sources where name = ? collate nocase').get(name); i++) name = `${o.name} (cópia ${i})`
          const kind: SourceKind = o.kind === 'propria' || o.kind === 'oficial' ? o.kind : 'outro'
          this.db
            .prepare('insert into sources (id, name, kind, abbreviation, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
            .run(destino, name, kind, String(o.abbreviation ?? '').slice(0, 20), now, now)
        }
        result.origens++
        for (const r of pacote.registros.filter((x) => x.sourceId === o.id)) {
          const parsed = SCHEMA[r.kind].safeParse(r.data)
          if (!parsed.success) continue
          const data = parsed.data as { nome: string }
          const json = JSON.stringify(data)
          const aqui = atualizar ? this.registroIgual(r.kind, destino, r.id, data.nome) : null
          if (aqui) {
            if (aqui.data === json) continue
            this.db.prepare(`update ${TABLE[r.kind]} set name = ?, data = ?, updated_at = ? where id = ?`).run(data.nome, json, now, aqui.id)
            result.atualizados++
          } else {
            const idLivre = !match && !this.db.prepare(`select 1 from ${TABLE[r.kind]} where id = ?`).get(r.id)
            this.db
              .prepare(`insert into ${TABLE[r.kind]} (id, source_id, name, data, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`)
              .run(idLivre ? r.id : newId(), destino, data.nome, json, now, now)
            result.novos++
          }
        }
      }
    })()
    for (const [nome, dados] of Object.entries(tokens)) {
      if (!/^[a-f0-9]{16}\.[a-z]{3,4}$/.test(nome)) continue
      mkdirSync(this.tokensDir, { recursive: true })
      if (!existsSync(join(this.tokensDir, nome))) writeFileSync(join(this.tokensDir, nome), dados)
    }
    return result
  }

  /** A origem daqui que é a mesma do pacote: pelo id, ou pelo nome. */
  private origemIgual(o: PacoteJson['origens'][number]): { id: string; name: string } | null {
    const porId = this.db.prepare('select id, name from sources where id = ?').get(o.id) as { id: string; name: string } | undefined
    const porNome = this.db.prepare('select id, name from sources where name = ? collate nocase').get(o.name) as { id: string; name: string } | undefined
    return porId ?? porNome ?? null
  }

  /** O registro daqui que é o mesmo do pacote, dentro da origem: pelo id, ou pelo nome. */
  private registroIgual(kind: LibraryKind, sourceId: string, id: string, nome: string): { id: string; data: string } | null {
    const porId = this.db.prepare(`select id, data from ${TABLE[kind]} where id = ? and source_id = ?`).get(id, sourceId) as { id: string; data: string } | undefined
    if (porId) return porId
    const alvo = fold(nome.trim())
    const rows = this.db.prepare(`select id, name, data from ${TABLE[kind]} where source_id = ?`).all(sourceId) as { id: string; name: string; data: string }[]
    return rows.find((r) => fold(r.name.trim()) === alvo) ?? null
  }

  private compararOrigem(pacote: PacoteJson, o: PacoteJson['origens'][number]): ImportPreviewSource {
    const match = this.origemIgual(o)
    const registros = pacote.registros.filter((r) => r.sourceId === o.id)
    const preview: ImportPreviewSource = { pacoteId: o.id, name: o.name, kind: o.kind, total: registros.length, match, novos: 0, mudam: 0, iguais: 0, soAqui: 0, mesmoNomeEmOutra: 0 }
    const vistos = new Set<string>()
    const outras = new Map(
      LIBRARY_KINDS.map((kind) => [
        kind,
        new Set((this.db.prepare(`select name from ${TABLE[kind]} where source_id <> ?`).all(match?.id ?? '') as { name: string }[]).map((x) => fold(x.name.trim())))
      ])
    )
    for (const r of registros) {
      const parsed = SCHEMA[r.kind].safeParse(r.data)
      if (!parsed.success) continue
      const data = parsed.data as { nome: string }
      const aqui = match ? this.registroIgual(r.kind, match.id, r.id, data.nome) : null
      if (!aqui) preview.novos++
      else {
        vistos.add(`${r.kind}:${aqui.id}`)
        if (aqui.data === JSON.stringify(data)) preview.iguais++
        else preview.mudam++
      }
      if (outras.get(r.kind)!.has(fold(data.nome.trim()))) preview.mesmoNomeEmOutra++
    }
    if (match)
      for (const kind of LIBRARY_KINDS)
        for (const r of this.db.prepare(`select id from ${TABLE[kind]} where source_id = ?`).all(match.id) as { id: string }[])
          if (!vistos.has(`${kind}:${r.id}`)) preview.soAqui++
    return preview
  }
}

export const PACOTE_EXT = '.magistrado-biblioteca'
/** Versão do formato do biblioteca.json do pacote. */
const PACOTE_FORMATO = 1

interface PacoteJson {
  app: 'Magistrado'
  pacote: number
  exportadoEm: string
  origens: { id: string; name: string; kind: SourceKind; abbreviation: string }[]
  registros: { kind: LibraryKind; id: string; sourceId: string; data: unknown }[]
}

function lerPacote(file: string): { pacote: PacoteJson; tokens: Record<string, Uint8Array> } {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(readFileSync(file), { filter: (f) => f.name === 'biblioteca.json' || f.name.startsWith('tokens/') })
  } catch {
    throw new Error('Não deu para ler este arquivo. Ele é um pacote da biblioteca do Magistrado?')
  }
  let pacote: PacoteJson | null = null
  try {
    pacote = entries['biblioteca.json'] ? (JSON.parse(strFromU8(entries['biblioteca.json'])) as PacoteJson) : null
  } catch {
    pacote = null
  }
  if (!pacote || pacote.app !== 'Magistrado' || !Array.isArray(pacote.origens) || !Array.isArray(pacote.registros))
    throw new Error('Este arquivo não é um pacote da biblioteca (é o backup de uma campanha?).')
  if (pacote.pacote > PACOTE_FORMATO) throw new Error('Pacote feito numa versão mais nova do app. Atualize o app para importar.')
  pacote.registros = pacote.registros.filter((r) => (LIBRARY_KINDS as readonly string[]).includes(r.kind) && typeof r.id === 'string' && typeof r.sourceId === 'string')
  const tokens: Record<string, Uint8Array> = {}
  for (const [nome, dados] of Object.entries(entries)) if (nome.startsWith('tokens/')) tokens[nome.slice('tokens/'.length)] = dados
  return { pacote, tokens }
}

// ------------------------------------------------------------ cópia para a campanha

const origem = origemDe

/** Ameaça da biblioteca como ficha da campanha: o nome vai para a ficha, o resto para o bloco. */
export function threatForCampaign(e: LibraryEntry<'ameaca'>): { name: string; sheetData: BlocoAmeaca; origin: Origem; token: string } {
  const { nome, pagina: _pagina, token, tokensExtras: _extras, ...bloco } = e.data
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
