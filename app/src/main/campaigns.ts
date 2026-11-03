import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nowIso, openDb } from './db'
import { createBackup } from './backup'
import { initCampaignRow, seedExample, syncOrdemTemplate } from './seed'
import { CampaignStore } from './store'
import type { BackupConfig, RecentCampaign, StructureTemplate } from '../shared/types'

const DB_FILE = 'campanha.sqlite'
const LOCK_FILE = '.lock'

// ------------------------------------------------------------ campanhas recentes (settings.json)

const settingsFile = () => join(app.getPath('userData'), 'settings.json')

type StoredRecent = Pick<RecentCampaign, 'name' | 'path' | 'openedAt'>

interface Settings {
  recent: StoredRecent[]
  backup?: Partial<BackupConfig>
  structures?: StructureTemplate[]
}

function readSettings(): Settings {
  try {
    return { recent: [], ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
  } catch {
    return { recent: [] }
  }
}

function writeSettings(s: Settings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsFile(), JSON.stringify(s, null, 2))
}

interface Peek {
  tagline: string | null
  epochDate: string | null
  coverFile: string | null
  counts: RecentCampaign['counts']
}

/** Lê a capa, a frase e os contadores de uma campanha sem abri-la (só leitura, não toca no .lock). */
function peek(path: string): Peek {
  let db: Database.Database | null = null
  try {
    db = new Database(join(path, DB_FILE), { readonly: true, fileMustExist: true })
    const c = db.prepare('select * from campaign').get() as { tagline: string | null; epoch_date: string; cover_id?: string | null }
    const cover = c.cover_id ? (db.prepare('select rel_path from attachments where id = ?').get(c.cover_id) as { rel_path: string } | undefined) : undefined
    const n = (table: string) => (db!.prepare(`select count(*) as n from ${table} where deleted_at is null`).get() as { n: number }).n
    return {
      tagline: c.tagline,
      epochDate: c.epoch_date,
      coverFile: cover && cover.rel_path.startsWith('anexos/') && !cover.rel_path.includes('..') ? join(path, cover.rel_path) : null,
      counts: { entities: n('entities'), scenes: n('scenes'), clues: n('clues') }
    }
  } catch {
    return { tagline: null, epochDate: null, coverFile: null, counts: null }
  } finally {
    db?.close()
  }
}

export function recentCampaigns(): RecentCampaign[] {
  return readSettings()
    .recent.filter((r) => existsSync(join(r.path, DB_FILE)))
    .map((r) => {
      const p = peek(r.path)
      return {
        ...r,
        tagline: p.tagline,
        epochDate: p.epochDate,
        counts: p.counts,
        coverUrl: p.coverFile ? `magistrado://capa/${encodeURIComponent(r.path)}` : null
      }
    })
}

/** Arquivo da capa de uma campanha recente, para o protocolo magistrado://capa/. Só campanhas da lista. */
export function recentCoverFile(path: string): string | null {
  if (!readSettings().recent.some((r) => r.path === path)) return null
  return peek(path).coverFile
}

// ------------------------------------------------------------ ações na biblioteca (campanha fechada)

/** Só mexe em pastas que estão na lista de recentes: o caminho vem da tela. */
function knownRecent(path: string): void {
  if (!readSettings().recent.some((r) => r.path === path)) throw new Error('Essa campanha não está na lista.')
  if (!existsSync(join(path, DB_FILE))) throw new Error('A pasta da campanha não foi encontrada.')
}

export function renameRecent(path: string, name: string): void {
  knownRecent(path)
  const db = openDb(join(path, DB_FILE))
  try {
    db.prepare('update campaign set name = ?, updated_at = ?').run(name, nowIso())
  } finally {
    db.close()
  }
  const s = readSettings()
  s.recent = s.recent.map((r) => (r.path === path ? { ...r, name } : r))
  writeSettings(s)
}

/** Backup de uma campanha fechada, sem abri-la na tela (não mexe na ordem dos recentes). */
export function backupRecent(path: string): string {
  knownRecent(path)
  const store = new CampaignStore(openDb(join(path, DB_FILE)), path)
  try {
    return createBackup(store, backupConfig().dir).file
  } finally {
    store.close()
  }
}

export function forgetRecent(path: string): void {
  const s = readSettings()
  s.recent = s.recent.filter((r) => r.path !== path)
  writeSettings(s)
}

export { knownRecent }

export function remember(name: string, path: string): void {
  const s = readSettings()
  s.recent = [{ name, path, openedAt: nowIso() }, ...s.recent.filter((r) => r.path !== path)].slice(0, 12)
  writeSettings(s)
}

// ------------------------------------------------------------ abrir e criar

// ------------------------------------------------------------ modelos de estrutura do usuário

export const userStructures = (): StructureTemplate[] => readSettings().structures ?? []

export function saveUserStructure(t: StructureTemplate): void {
  const s = readSettings()
  s.structures = [...(s.structures ?? []).filter((x) => x.id !== t.id), t]
  writeSettings(s)
}

export function removeUserStructure(id: string): void {
  const s = readSettings()
  s.structures = (s.structures ?? []).filter((x) => x.id !== id)
  writeSettings(s)
}

// ------------------------------------------------------------ configuração do backup

export function backupConfig(): BackupConfig {
  // Fora da pasta das campanhas, para um problema no disco não levar os dois juntos.
  const dir = process.env.MAGISTRADO_BACKUP_DIR || join(app.getPath('documents'), 'Backups de campanhas')
  return { dir, intervalMin: 30, keep: 5, ...readSettings().backup }
}

export function setBackupConfig(patch: Partial<BackupConfig>): BackupConfig {
  const s = readSettings()
  s.backup = { ...s.backup, ...patch }
  writeSettings(s)
  return backupConfig()
}

export function defaultCampaignsDir(): string {
  // MAGISTRADO_CAMPAIGNS_DIR: só para testes, que rodam numa pasta temporária.
  return process.env.MAGISTRADO_CAMPAIGNS_DIR || join(app.getPath('documents'), 'Campanhas Magistrado')
}

const safeFolderName = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 80) || 'Campanha'

export function openCampaign(path: string): CampaignStore {
  const file = join(path, DB_FILE)
  if (!existsSync(file)) throw new Error(`Nenhuma campanha em ${path}.`)
  const store = new CampaignStore(openDb(file), path)
  syncOrdemTemplate(store.db)
  store.purgeOld(60)
  writeFileSync(join(path, LOCK_FILE), String(process.pid))
  remember(store.campaign().name, path)
  return store
}

export function closeCampaign(store: CampaignStore): void {
  store.close()
  rmSync(join(store.path, LOCK_FILE), { force: true })
}

export function createCampaign(input: { name: string; epochDate: string; example?: boolean }): CampaignStore {
  const base = defaultCampaignsDir()
  let path = join(base, `${safeFolderName(input.name)}.magistrado`)
  for (let i = 2; existsSync(path); i++) path = join(base, `${safeFolderName(input.name)} (${i}).magistrado`)
  mkdirSync(join(path, 'anexos'), { recursive: true })

  const db = openDb(join(path, DB_FILE), (fresh) => initCampaignRow(fresh, input.name, input.epochDate))
  const store = new CampaignStore(db, path)
  if (input.example) seedExample(store)
  writeFileSync(join(path, LOCK_FILE), String(process.pid))
  remember(input.name, path)
  return store
}

