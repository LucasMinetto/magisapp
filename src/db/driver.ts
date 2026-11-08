import { open, type DB as NativeDB } from '@op-engineering/op-sqlite';

export type DB = NativeDB;

export type DriverOptions = { name: string; location?: string };

/**
 * Native (iOS / Android / Node) driver: op-sqlite's synchronous open() is available here,
 * so the connection is ready the moment openDriver() returns.
 */
export function openDriver(options: DriverOptions): DB {
  const db = open(options);
  db.executeSync('PRAGMA foreign_keys = ON;');
  try {
    db.executeSync('PRAGMA journal_mode = WAL;');
  } catch {
    // WAL is unavailable on some filesystems; the connection still works.
  }
  return db;
}
