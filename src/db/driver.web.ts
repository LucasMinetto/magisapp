import { openAsync, type DB as NativeDB } from '@op-engineering/op-sqlite';

export type DB = NativeDB;

export type DriverOptions = { name: string; location?: string };

/**
 * Web driver. op-sqlite's web backend (sqlite-wasm) is async-only: open() throws, so the
 * connection is opened with openAsync() and every method awaits it. The app's hooks call
 * getDB() synchronously and then `await db.execute(...)`, which this proxy supports.
 */
class WebDB {
  private readonly ready: Promise<NativeDB>;

  constructor(options: DriverOptions) {
    this.ready = openAsync(options).then(async (db) => {
      await db.execute('PRAGMA foreign_keys = ON;');
      return db;
    });
  }

  async execute(sql: string, params?: unknown[]) {
    const db = await this.ready;
    return db.execute(sql, params as never);
  }

  async executeBatch(batch: unknown[]) {
    const db = await this.ready;
    return db.executeBatch(batch as never);
  }

  async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const db = await this.ready;
    return db.transaction(fn as never) as Promise<T>;
  }

  close(): void {
    this.ready
      .then((db) => db.close())
      .catch(() => {
        /* already closed */
      });
  }

  executeSync(): never {
    throw new Error(
      '[magistrado] executeSync não existe no backend web — use execute() (assíncrono).'
    );
  }
}

export function openDriver(options: DriverOptions): DB {
  return new WebDB(options) as unknown as DB;
}
