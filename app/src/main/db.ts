import Database from 'better-sqlite3'
import schema from './schema.sql?raw'

export type DB = Database.Database

export const SCHEMA_VERSION = 3

/** Migração n leva o banco da versão n-1 para n. O schema.sql é sempre a versão 1. */
const MIGRATIONS: Record<number, string> = {
  2: 'alter table campaign add column cover_id text references attachments(id) on delete set null;',
  // Mapa do lugar (imagem pronta da internet) e blocos de notas do mestre por cena.
  3: `alter table entities add column map_id text references attachments(id) on delete set null;
      create table scene_notes (
        id          text primary key,
        scene_id    text not null references scenes(id) on delete cascade,
        title       text not null default '',
        body        text not null default '',
        sort        integer not null default 0,
        created_at  text not null,
        updated_at  text not null
      );
      create index scene_notes_scene on scene_notes (scene_id, sort);`
}

/** Banco vazio já na versão atual, sem a linha de campaign (para restaurar do campanha.json). */
export function createEmptyDb(file: string): DB {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(schema)
  for (let v = 2; v <= SCHEMA_VERSION; v++) db.exec(MIGRATIONS[v])
  return db
}

export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

/**
 * Abre o banco de uma campanha. Com `init`, cria o arquivo: aplica o esquema e roda `init`
 * (que insere a linha de campaign) na mesma transação.
 */
export function openDb(file: string, init?: (db: DB) => void): DB {
  const db = new Database(file, { fileMustExist: !init })
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  if (init) {
    db.transaction(() => {
      db.exec(schema)
      init(db)
    })()
  }
  const row = db.prepare('select schema_version as v from campaign').get() as { v: number } | undefined
  if (!row) throw new Error('Este arquivo não é uma campanha (tabela campaign vazia).')
  if (row.v > SCHEMA_VERSION) throw new Error('Campanha criada numa versão mais nova do app. Atualize o app para abrir.')
  if (row.v < SCHEMA_VERSION) {
    // Cópia do banco antes de mexer no esquema (VACUUM INTO é síncrono e consistente com o WAL).
    if (!init) db.exec(`vacuum into '${`${file}.v${row.v}.bak`.replaceAll("'", "''")}'`)
    db.transaction(() => {
      for (let v = row.v + 1; v <= SCHEMA_VERSION; v++) {
        db.exec(MIGRATIONS[v])
        db.prepare('update campaign set schema_version = ?').run(v)
      }
    })()
  }
  return db
}
