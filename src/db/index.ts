import { openDriver, type DB } from './driver';
import { seedDatabase } from './seed';
// Node.js fs for test environment
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Migration SQL as constant (version 1 is static; file kept for reference)
const MIGRATION_V1_SQL = `
-- Migration 001: Initial schema v1
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Ficha do agente (um por campanha por usuário)
CREATE TABLE ficha (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sheet_data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX idx_ficha_updated_at ON ficha(updated_at);

-- Biblioteca: Rituais
CREATE TABLE biblioteca_ritual (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  elemento TEXT NOT NULL,
  circulo INTEGER NOT NULL,
  execucao TEXT,
  alcance TEXT,
  alvo TEXT,
  duracao TEXT,
  resistencia TEXT,
  efeito TEXT,
  discente TEXT,
  verdadeiro TEXT,
  dano_normal TEXT,
  dano_discente TEXT,
  dano_verdadeiro TEXT,
  tipo_dano TEXT,
  alvo_tipo TEXT,
  pagina INTEGER,
  data TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE(source_id, nome)
);
CREATE INDEX idx_bib_ritual_elemento_circulo ON biblioteca_ritual(elemento, circulo);

-- Biblioteca: Itens
CREATE TABLE biblioteca_item (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria INTEGER NOT NULL,
  espacos REAL NOT NULL,
  defesa REAL NOT NULL,
  dano TEXT,
  tipo_dano TEXT,
  critico TEXT,
  alcance TEXT,
  proficiencia TEXT,
  empunhadura TEXT,
  elemento TEXT,
  descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  pagina INTEGER,
  data TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE(source_id, nome)
);
CREATE INDEX idx_bib_item_tipo_categoria ON biblioteca_item(tipo, categoria);

-- Regras
CREATE TABLE regras (
  id TEXT PRIMARY KEY,
  capitulo INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  pagina_livro INTEGER,
  visivel_para_jogadores INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(capitulo)
);

-- Arquivo: Pessoas
CREATE TABLE arquivo_pessoa (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  retrato_url TEXT,
  o_que_sabe TEXT NOT NULL,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, user_id, id)
);

-- Arquivo: Lugares
CREATE TABLE arquivo_lugar (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  imagem_url TEXT,
  descricao_publica TEXT NOT NULL,
  versao_atual INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, user_id, id)
);

-- Arquivo: Anotações
CREATE TABLE arquivo_anotacao (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  linked_pessoa_id TEXT REFERENCES arquivo_pessoa(id) ON DELETE SET NULL,
  linked_lugar_id TEXT REFERENCES arquivo_lugar(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_anotacao_campaign_user ON arquivo_anotacao(campaign_id, user_id);

-- Arquivo: Histórico
CREATE TABLE arquivo_historico (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pessoa_v1', 'lugar_v2', 'interludio', 'anotacao')),
  ref_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  autor TEXT NOT NULL CHECK (autor IN ('mestre', 'jogador')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_historico_campaign_user ON arquivo_historico(campaign_id, user_id);

-- Sync Queue
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('pull', 'push_ficha', 'push_rolagem', 'push_anotacao')),
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  error TEXT
);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);

-- Auth
CREATE TABLE auth (
  key TEXT PRIMARY KEY CHECK (key = 'current_user' OR key LIKE 'token_%'),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// Migration v2 (expo embedded copy; migrations/002_rolagens.sql is the node source of truth)
const MIGRATION_V2_SQL = `
-- Migration 002: histórico de rolagens do jogador
CREATE TABLE rolagens (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('teste', 'ataque', 'dano', 'ritual', 'livre')),
  rotulo TEXT,
  formula TEXT NOT NULL,
  dados TEXT NOT NULL,
  total INTEGER NOT NULL,
  critico INTEGER NOT NULL DEFAULT 0,
  falha INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX idx_rolagens_campaign_user_created ON rolagens(campaign_id, user_id, created_at);
`;


export enum DB_TABLES {
  FICHA = 'ficha',
  BIBLIOTECA_RITUAL = 'biblioteca_ritual',
  BIBLIOTECA_ITEM = 'biblioteca_item',
  REGRAS = 'regras',
  ARQUIVO_PESSOA = 'arquivo_pessoa',
  ARQUIVO_LUGAR = 'arquivo_lugar',
  ARQUIVO_ANOTACAO = 'arquivo_anotacao',
  ARQUIVO_HISTORICO = 'arquivo_historico',
  SYNC_QUEUE = 'sync_queue',
  AUTH = 'auth',
  ROLAGENS = 'rolagens',
}

let _db: DB | null = null;
let _gatedDb: DB | null = null;

/** Underlying (ungated) connection — used by the bootstrap so the gate can't deadlock. */
function getRawDB(): DB {
  if (!_db) {
    _db = openDriver({ name: 'magistrado.db' });
  }
  return _db;
}

/** Await the driver's ready promise (native: PRAGMAs; web: async open). */
async function waitDriverReady(db: DB): Promise<void> {
  // The driver wrapper exposes a `ready` property (getter returning Promise<NativeDB>).
  if (db.ready) {
    await db.ready;
  }
}

/**
 * Métodos do DB que precisam esperar o bootstrap. Qualquer outra propriedade
 * (incl. `close`) passa direto para a conexão real.
 */
const GATED_METHODS = new Set<PropertyKey>(['execute', 'executeBatch', 'transaction']);

/**
 * Envolve o DB para que toda consulta (`execute` / `executeBatch` / `transaction`)
 * aguarde o bootstrap (migrações + seed) antes de rodar. Assim nenhum hook ou tela
 * consegue consultar antes da hora, mesmo disparando a query no primeiro render.
 */
function createGatedDB(raw: DB): DB {
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'close') {
        return () => (target as unknown as { close: () => void }).close();
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') {
        return value;
      }
      if (GATED_METHODS.has(prop)) {
        return (...args: unknown[]) =>
          ensureDatabaseReady().then(() =>
            (value as (...a: unknown[]) => unknown).apply(target, args)
          );
      }
      return (value as (...a: unknown[]) => unknown).bind(target);
    },
  });
}

export function getDB(): DB {
  if (!_gatedDb) {
    _gatedDb = createGatedDB(getRawDB());
  }
  return _gatedDb;
}

export async function openDB(dbPath: string = 'magistrado.db'): Promise<DB> {
  const options: { name: string; location?: string } = { name: dbPath };
  if (dbPath === ':memory:') {
    options.location = ':memory:';
  }
  return openDriver(options);
}

function readMigrationFileNode(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationPath = path.resolve(__dirname, 'migrations/001_init.sql');
  return fs.readFileSync(migrationPath, 'utf-8');
}

function readMigrationFileExpo(): string {
  // In Expo, use the embedded constant (migration v1 is static)
  return MIGRATION_V1_SQL;
}

async function readMigrationFile(): Promise<string> {
  if (typeof process !== 'undefined' && !!process.versions?.node && !!process.env.VITEST) {
    return readMigrationFileNode();
  }
  return readMigrationFileExpo();
}

function readMigrationV2FileNode(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationPath = path.resolve(__dirname, 'migrations/002_rolagens.sql');
  return fs.readFileSync(migrationPath, 'utf-8');
}

async function readMigrationV2File(): Promise<string> {
  if (typeof process !== 'undefined' && !!process.versions?.node && !!process.env.VITEST) {
    return readMigrationV2FileNode();
  }
  return MIGRATION_V2_SQL;
}

/** Splits a migration file into executable statements (drops comment-only lines). */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(s =>
      s
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(s => s.length > 0);
}

async function applyMigration(db: DB, sql: string): Promise<void> {
  const statements = splitStatements(sql);
  // PRAGMA statements don't work well inside executeBatch on every driver.
  for (const stmt of statements) {
    if (stmt.toUpperCase().startsWith('PRAGMA ')) {
      await db.execute(stmt);
    }
  }
  const nonPragma = statements.filter(s => !s.toUpperCase().startsWith('PRAGMA '));
  if (nonPragma.length > 0) {
    await db.executeBatch(nonPragma.map(s => [s]));
  }
}

/**
 * Lê `PRAGMA user_version` sem depender de o driver devolver linhas para PRAGMAs.
 * O driver nativo roteia qualquer não-SELECT por `.run()` (sem linhas), então usamos
 * a função tabular `pragma_user_version`, que é um SELECT normal. Aceita tanto
 * `user_version` quanto `version` (o driver web devolve nomes diferentes).
 */
async function readUserVersion(db: DB): Promise<number> {
  try {
    const row = (await db.execute('SELECT user_version FROM pragma_user_version;')).rows?.[0] ?? {};
    const r = row as Record<string, unknown>;
    return Number(r.user_version ?? r.version ?? 0);
  } catch {
    return 0;
  }
}

export async function runMigrations(db: DB): Promise<void> {
  // Async-only so the same code path works on native and on the web backend.
  let currentVersion = await readUserVersion(db);

  if (currentVersion === 0) {
    await applyMigration(db, await readMigrationFile());
    await db.execute('PRAGMA user_version = 1;');
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await applyMigration(db, await readMigrationV2File());
    await db.execute('PRAGMA user_version = 2;');
  }
}

// --- Bootstrap (migrações + seed) com gate global ---

let _readyPromise: Promise<void> | null = null;
let _bootstrapError: Error | null = null;

async function bootstrapDatabase(): Promise<void> {
  const db = getRawDB();
  await waitDriverReady(db);
  await runMigrations(db);
  // Guarda antes do seed (que também é idempotente por si só).
  const result = await db.execute(`SELECT COUNT(*) as c FROM ${DB_TABLES.REGRAS};`);
  const total = Number((result.rows?.[0] as Record<string, unknown> | undefined)?.c ?? 0);
  if (total === 0) {
    await seedDatabase(db);
  }
}

/**
 * Prepara o banco uma única vez por processo: abre a conexão, roda as migrações e,
 * se ainda não houver regras, roda o seed. A promise é memoizada; numa falha, o erro
 * fica exposto em `getDatabaseError()` e a promise é zerada para permitir nova tentativa.
 */
export function ensureDatabaseReady(): Promise<void> {
  if (!_readyPromise) {
    _bootstrapError = null;
    _readyPromise = Promise.resolve()
      .then(() => bootstrapDatabase())
      .catch((err: unknown) => {
        _bootstrapError = err instanceof Error ? err : new Error(String(err));
        _readyPromise = null;
        throw _bootstrapError;
      });
  }
  return _readyPromise;
}

/** Último erro de bootstrap, ou null se o banco ficou pronto (ou nunca tentou). */
export function getDatabaseError(): Error | null {
  return _bootstrapError;
}

export function closeDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
  _gatedDb = null;
  _readyPromise = null;
  _bootstrapError = null;
}

export { seedDatabase };
export type { FichaAgente } from '../shared/ordem/esquemas';
export type { RitualBiblioteca, ItemBiblioteca } from '../shared/ordem/esquemas';
