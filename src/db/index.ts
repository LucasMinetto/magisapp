import { openDriver, type DB } from './driver';
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

type OpenOptions = {
  name: string;
  location?: string;
  encryptionKey?: string;
  failOnCreate?: boolean;
  readOnly?: boolean;
};

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
}

let _db: DB | null = null;

export function getDB(): DB {
  if (!_db) {
    _db = openDriver({ name: 'magistrado.db' });
  }
  return _db;
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

export async function runMigrations(db: DB): Promise<void> {
  // Async-only so the same code path works on native and on the web backend.
  const versionRow = (await db.execute('PRAGMA user_version;')).rows?.[0] ?? {};
  const currentVersion = Number(versionRow.version ?? versionRow.user_version ?? 0);

  if (currentVersion === 0) {
    const sql = await readMigrationFile();
    // Split by semicolon, remove comment lines, filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    // Execute PRAGMA statements first (they don't work well in batch)
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('PRAGMA ')) {
        await db.execute(stmt);
      }
    }
    // Execute remaining statements in batch
    const nonPragmaStatements = statements.filter(s => !s.toUpperCase().startsWith('PRAGMA '));
    await db.executeBatch(nonPragmaStatements.map(s => [s]));
    await db.execute('PRAGMA user_version = 1;');
  }
  // Future migrations: if (currentVersion === 1) { ... }
}

export function closeDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export { seedDatabase } from './seed';
export type { FichaAgente } from '../shared/ordem/esquemas';
export type { RitualBiblioteca, ItemBiblioteca } from '../shared/ordem/esquemas';
