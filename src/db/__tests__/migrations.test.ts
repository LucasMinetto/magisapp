import { openDB, runMigrations } from '../index';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const V1_SQL = fs.readFileSync(path.resolve(here, '../migrations/001_init.sql'), 'utf-8');

/** Splits a migration file into statements, dropping comments and PRAGMAs
 *  (the driver already applies foreign_keys/journal_mode on open). */
function statementsOf(sql: string): string[] {
  return sql
    .split(';')
    .map(s =>
      s
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(s => s.length > 0)
    .filter(s => !s.toUpperCase().startsWith('PRAGMA '));
}

function userVersionOf(row: Record<string, unknown> | undefined): number {
  return Number(row?.user_version ?? row?.version ?? 0);
}

/** Reads user_version through the table-valued function, since the native driver
 *  returns no rows for a bare `PRAGMA user_version` statement. */
async function readUserVersion(db: DB): Promise<number> {
  const res = await db.execute('SELECT user_version FROM pragma_user_version;');
  return userVersionOf(res.rows[0] as Record<string, unknown> | undefined);
}

describe('migração v2 (rolagens)', () => {
  let db: DB;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = `test_migrations_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
    db = await openDB(tempDbPath);
  });

  afterEach(() => {
    if (db) db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const p = tempDbPath + suffix;
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  async function tableNames(): Promise<string[]> {
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return res.rows.map(r => r.name as string);
  }

  it('banco novo aplica v1 + v2 e termina em user_version = 2', async () => {
    await runMigrations(db);

    expect(await readUserVersion(db)).toBe(2);

    const tables = await tableNames();
    expect(tables).toContain('rolagens');
    expect(tables).toContain('ficha'); // v1 continua intacta

    const indexes = await db.execute("SELECT name FROM sqlite_master WHERE type='index'");
    expect(indexes.rows.map(r => r.name)).toContain('idx_rolagens_campaign_user_created');
  });

  it('rolagens aceita INSERT e SELECT', async () => {
    await runMigrations(db);

    await db.execute(
      `INSERT INTO rolagens
        (id, campaign_id, user_id, tipo, rotulo, formula, dados, total, critico, falha, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['r1', 'c1', 'u1', 'teste', 'Luta', '1d20+5', '[18]', 23, 0, 0, '2026-01-01T00:00:00Z']
    );

    const rows = (await db.execute('SELECT * FROM rolagens')).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].total).toBe(23);
    expect(rows[0].tipo).toBe('teste');
    expect(rows[0].critico).toBe(0);
    expect(rows[0].falha).toBe(0);
  });

  it('rejeita tipo fora do domínio permitido', async () => {
    await runMigrations(db);

    await expect(
      db.execute(
        `INSERT INTO rolagens (id, campaign_id, user_id, tipo, formula, dados, total, created_at)
         VALUES ('x', 'c1', 'u1', 'invalido', '1d20', '[1]', 1, '2026-01-01T00:00:00Z')`
      )
    ).rejects.toThrow();
  });

  it('banco v1 existente migra para v2 sem perder linhas', async () => {
    // Reproduz um app instalado: banco só com o schema v1.
    await db.executeBatch(statementsOf(V1_SQL).map(s => [s]));
    await db.execute('PRAGMA user_version = 1;');
    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at)
       VALUES ('f1', 'c1', 'u1', '{"jogador":"Teste"}', '2026-01-01T00:00:00Z')`
    );

    const before = await readUserVersion(db);
    expect(before).toBe(1);

    await runMigrations(db);

    expect(await readUserVersion(db)).toBe(2);

    // sem perda de dados
    const ficha = await db.execute('SELECT * FROM ficha');
    expect(ficha.rows.length).toBe(1);
    expect(JSON.parse(ficha.rows[0].sheet_data as string).jogador).toBe('Teste');

    // e a v2 existe
    const tables = await tableNames();
    expect(tables).toContain('rolagens');
  });

  it('runMigrations é idempotente (rodar duas vezes não quebra)', async () => {
    await runMigrations(db);
    await runMigrations(db);

    expect(await readUserVersion(db)).toBe(2);

    const tables = await tableNames();
    expect(tables.filter(t => t === 'rolagens').length).toBe(1);
  });
});
