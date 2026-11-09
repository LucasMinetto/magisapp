import { open, type DB as NativeDB } from '@op-engineering/op-sqlite';

export type DB = NativeDB & { ready?: Promise<NativeDB> };

export type DriverOptions = { name: string; location?: string };

/**
 * Native driver wrapper with a ready promise (like the web driver).
 * The ready promise resolves after the database is opened and PRAGMAs are set.
 * All async methods await this ready promise before executing.
 */
class NativeDBWrapper {
  private readonly _ready: Promise<NativeDB>;
  private _db: NativeDB | null = null;

  constructor(options: DriverOptions) {
    this._ready = Promise.resolve().then(() => {
      const db = open(options);
      db.executeSync('PRAGMA foreign_keys = ON;');
      try {
        db.executeSync('PRAGMA journal_mode = WAL;');
      } catch {
        // WAL is unavailable on some filesystems; the connection still works.
      }
      this._db = db;
      return db;
    });
  }

  get ready(): Promise<NativeDB> {
    return this._ready;
  }

  async execute(sql: string, params?: unknown[]) {
    const db = await this._ready;
    return db.execute(sql, params as never);
  }

  async executeBatch(batch: unknown[]) {
    const db = await this._ready;
    return db.executeBatch(batch as never);
  }

  async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const db = await this._ready;
    return db.transaction(fn as never) as Promise<T>;
  }

  close(): void {
      if (this._db) {
        this._db.close();
        this._db = null;
      }
    }

  // Sync method for internal use (e.g., PRAGMAs during init) — not gated.
  executeSync(sql: string, params?: unknown[]) {
    if (!this._db) {
      throw new Error('Database not initialized — call executeSync only after ready resolves');
    }
    return this._db.executeSync(sql, params as never);
  }
}

export function openDriver(options: DriverOptions): DB {
  return new NativeDBWrapper(options) as unknown as DB;
}
