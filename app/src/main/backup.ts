// Backup em arquivo único (.mesa-backup = zip comum) e restauração.
//   campanha.sqlite   cópia consistente (VACUUM INTO), o caminho normal para restaurar
//   campanha.json     todas as tabelas em texto; restaura se o banco estiver corrompido
//   anexos/           imagens e arquivos, com o nome legível de sempre
//   legivel/          cofre Markdown + .canvas (vault.ts), para abrir no Obsidian sem o app
// Sem Electron aqui: dá para testar com vitest.
import Database from 'better-sqlite3'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEmptyDb, newId, SCHEMA_VERSION, type DB } from './db'
import type { CampaignStore } from './store'
import { buildVault, README, safeFileName } from './vault'
import type { BackupEntry } from '../shared/types'

export const BACKUP_EXT = '.mesa-backup'
/** Versão do formato do campanha.json. Sobe quando a forma do arquivo mudar. */
export const JSON_FORMAT = 1

// Tabelas derivadas: refeitas ao restaurar, não vão para o json.
const DERIVED = new Set(['search_index', 'mentions'])

export interface CampaignJson {
  formato: number
  app: 'Mesa'
  schemaVersion: number
  exportadoEm: string
  tabelas: Record<string, Record<string, unknown>[]>
}

const dataTables = (db: DB) =>
  (db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like 'search_index%' order by name").all() as { name: string }[])
    .map((r) => r.name)
    .filter((n) => !DERIVED.has(n))

export function dumpJson(db: DB): CampaignJson {
  const tabelas: CampaignJson['tabelas'] = {}
  for (const t of dataTables(db)) tabelas[t] = db.prepare(`select * from "${t}"`).all() as Record<string, unknown>[]
  return { formato: JSON_FORMAT, app: 'Mesa', schemaVersion: SCHEMA_VERSION, exportadoEm: new Date().toISOString(), tabelas }
}

/** Cria um banco novo a partir do json. Colunas que não existem mais são ignoradas; as novas ficam no padrão. */
export function loadJson(json: CampaignJson, file: string): void {
  if (json.app !== 'Mesa' || typeof json.tabelas !== 'object') throw new Error('Este campanha.json não é de uma campanha do Mesa.')
  if (json.formato > JSON_FORMAT) throw new Error('Backup feito numa versão mais nova do app.')
  const db = createEmptyDb(file)
  try {
    db.pragma('foreign_keys = OFF') // a ordem das tabelas no json não segue as chaves; confere no fim
    db.transaction(() => {
      for (const table of dataTables(db)) {
        const rows = json.tabelas[table] ?? []
        if (!rows.length) continue
        const cols = new Set((db.prepare(`pragma table_info("${table}")`).all() as { name: string }[]).map((c) => c.name))
        for (const row of rows) {
          const keys = Object.keys(row).filter((k) => cols.has(k))
          db.prepare(`insert into "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) values (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => row[k] as never))
        }
      }
      db.prepare('update campaign set schema_version = ?').run(SCHEMA_VERSION)
    })()
    const broken = db.pragma('foreign_key_check') as unknown[]
    if (broken.length) throw new Error(`O campanha.json tem ${broken.length} referências quebradas.`)
  } finally {
    db.close()
  }
}

// ------------------------------------------------------------ criar

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`
}

export interface BackupResult {
  file: string
  sizeBytes: number
}

/** Gera o backup na pasta. Os automáticos levam "(auto)" no nome e só os `keep` mais novos ficam. */
export function createBackup(store: CampaignStore, dir: string, opts: { auto?: boolean; keep?: number; now?: Date } = {}): BackupResult {
  mkdirSync(dir, { recursive: true })
  const name = safeFileName(store.campaign().name, 'Campanha')
  const base = `${name} ${stamp(opts.now ?? new Date())}${opts.auto ? ' (auto)' : ''}`
  let file = join(dir, `${base}${BACKUP_EXT}`)
  for (let i = 2; existsSync(file); i++) file = join(dir, `${base} ${i}${BACKUP_EXT}`)

  // Nunca copiar o .sqlite aberto direto (o WAL deixa a cópia pela metade).
  const tmp = join(tmpdir(), `mesa-${newId()}.sqlite`)
  store.db.exec(`vacuum into '${tmp.replaceAll("'", "''")}'`)
  try {
    const files: Zippable = {
      'LEIA-ME.md': strToU8(README),
      'campanha.sqlite': readFileSync(tmp),
      'campanha.json': strToU8(JSON.stringify(dumpJson(store.db)))
    }
    for (const a of store.db.prepare('select rel_path from attachments').all() as { rel_path: string }[]) {
      const src = join(store.path, a.rel_path)
      // Imagens já vêm comprimidas: guardar sem comprimir de novo é mais rápido e do mesmo tamanho.
      if (a.rel_path.startsWith('anexos/') && existsSync(src)) files[a.rel_path] = [readFileSync(src), { level: 0 }]
    }
    for (const f of buildVault(store)) files[f.path] = strToU8(f.text)
    const zip = zipSync(files, { level: 6 })
    writeFileSync(`${file}.parcial`, zip)
    renameSync(`${file}.parcial`, file) // aparece inteiro ou não aparece
    if (opts.auto) prune(dir, name, opts.keep ?? 5)
    return { file, sizeBytes: zip.byteLength }
  } finally {
    rmSync(tmp, { force: true })
  }
}

/** Backups de uma campanha na pasta, do mais novo para o mais velho. */
export function listBackups(dir: string, campaignName: string): BackupEntry[] {
  if (!existsSync(dir)) return []
  const prefix = `${safeFileName(campaignName, 'Campanha')} `
  return readdirSync(dir)
    .filter((f) => f.endsWith(BACKUP_EXT) && f.startsWith(prefix))
    .map((f) => {
      const st = statSync(join(dir, f))
      return { file: join(dir, f), name: f, auto: f.includes(' (auto)'), sizeBytes: st.size, createdAt: st.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name))
}

function prune(dir: string, campaignName: string, keep: number): void {
  const autos = listBackups(dir, campaignName).filter((b) => b.auto)
  for (const old of autos.slice(keep)) rmSync(old.file, { force: true })
}

// ------------------------------------------------------------ restaurar

/** Só aceita caminhos do formato esperado: nada de "..", nada fora de anexos/. */
const safeAttachmentPath = (p: string) => /^anexos\/[^/\\]+$/.test(p) && !p.includes('..')

/**
 * Abre um backup como campanha NOVA em `destBase` e devolve a pasta. Nunca sobrescreve.
 * Usa o campanha.sqlite; se faltar ou estiver corrompido, monta o banco do campanha.json.
 */
export function restoreBackup(file: string, destBase: string, now = new Date()): { path: string; fromJson: boolean } {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(readFileSync(file), { filter: (f) => f.name === 'campanha.sqlite' || f.name === 'campanha.json' || safeAttachmentPath(f.name) })
  } catch {
    throw new Error('Não deu para ler este arquivo. Ele é um backup do Mesa?')
  }
  const json = entries['campanha.json'] ? (JSON.parse(strFromU8(entries['campanha.json'])) as CampaignJson) : null
  const name = (json?.tabelas.campaign?.[0]?.name as string | undefined) ?? 'Campanha restaurada'
  const label = `${safeFileName(name, 'Campanha')} (restaurada ${stamp(now).slice(0, 10)})`
  let path = join(destBase, `${label}.mesa`)
  for (let i = 2; existsSync(path); i++) path = join(destBase, `${label} ${i}.mesa`)
  mkdirSync(join(path, 'anexos'), { recursive: true })

  for (const [p, data] of Object.entries(entries)) if (safeAttachmentPath(p)) writeFileSync(join(path, p), data)

  const dbFile = join(path, 'campanha.sqlite')
  let fromJson = false
  const sqliteOk = (() => {
    if (!entries['campanha.sqlite']) return false
    writeFileSync(dbFile, entries['campanha.sqlite'])
    let db: Database.Database | null = null
    try {
      db = new Database(dbFile, { fileMustExist: true })
      return db.pragma('integrity_check', { simple: true }) === 'ok' && !!db.prepare('select 1 from campaign').get()
    } catch {
      return false
    } finally {
      db?.close() // no Windows, arquivo aberto não pode ser apagado depois
    }
  })()
  if (!sqliteOk) {
    if (!json) {
      rmSync(path, { recursive: true, force: true })
      throw new Error('O backup não tem um banco que abra nem o campanha.json.')
    }
    for (const f of ['campanha.sqlite', 'campanha.sqlite-wal', 'campanha.sqlite-shm']) rmSync(join(path, f), { force: true })
    loadJson(json, dbFile)
    fromJson = true
  }
  return { path, fromJson }
}
