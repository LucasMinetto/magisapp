import { open, type DB } from '@op-engineering/op-sqlite';
// Node.js fs for test environment
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
    _db = open({ name: 'magistrado.db' });
    _db.executeSync('PRAGMA foreign_keys = ON;');
    _db.executeSync('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

export async function openDB(dbPath: string = 'magistrado.db'): Promise<DB> {
  const options: OpenOptions = { name: dbPath };
  if (dbPath === ':memory:') {
    options.location = ':memory:';
  }
  const db = open(options);
  db.executeSync('PRAGMA foreign_keys = ON;');
  db.executeSync('PRAGMA journal_mode = WAL;');
  return db;
}

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node && !!process.env.VITEST;
}

async function readMigrationFileExpo(): Promise<string> {
  // Dynamic imports to avoid static analysis issues in test environment
  const { Asset } = await import('expo-asset');
  const FileSystem = await import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../migrations/001_init.sql'));
  await asset.downloadAsync();
  return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
}

async function readMigrationFileNode(): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Migration file is in src/db/migrations/ relative to src/db/index.ts
  const migrationPath = path.resolve(__dirname, 'migrations/001_init.sql');
  return fs.readFileSync(migrationPath, 'utf-8');
}

async function readMigrationFile(): Promise<string> {
  if (isTestEnvironment()) {
    return readMigrationFileNode();
  }
  return readMigrationFileExpo();
}

export async function runMigrations(db: DB): Promise<void> {
  const currentVersion = db.executeSync('PRAGMA user_version;').rows[0]?.version ?? 0;

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
      const upper = stmt.toUpperCase();
      if (upper.startsWith('PRAGMA ')) {
        db.executeSync(stmt);
      }
    }
    // Execute remaining statements in batch
    const nonPragmaStatements = statements.filter(s => !s.toUpperCase().startsWith('PRAGMA '));
    await db.executeBatch(nonPragmaStatements.map(s => [s]));
    db.executeSync('PRAGMA user_version = 1;');
  }
  // Future migrations: if (currentVersion === 1) { ... }
}

export function closeDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
