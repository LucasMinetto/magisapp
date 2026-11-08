import { openDB, runMigrations } from '../index';
import { describe, it, expect, beforeEach } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';

describe('DB Schema v1', () => {
  let db: DB;
  beforeEach(async () => {
    db = await openDB(':memory:');
    await runMigrations(db);
  });

  it('creates all 11 tables', async () => {
    const tables = await db.execute('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'');
    const names = tables.rows.map(t => t.name).sort();
    expect(names).toEqual([
      'ficha',
      'biblioteca_ritual',
      'biblioteca_item',
      'regras',
      'arquivo_pessoa',
      'arquivo_lugar',
      'arquivo_anotacao',
      'arquivo_historico',
      'sync_queue',
      'auth',
    ].sort());
  });

  it('enforces foreign keys', async () => {
    await expect(db.execute(
      "INSERT INTO arquivo_anotacao (id, campaign_id, user_id, titulo, conteudo, linked_pessoa_id, created_at, updated_at) VALUES ('a1', 'c1', 'u1', 'Test', 'Test', 'nonexistent', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
  });

  it('has indexes on sync_queue.status and ficha.updated_at', async () => {
    const indexes = await db.execute('SELECT name FROM sqlite_master WHERE type=\'index\'');
    const names = indexes.rows.map(i => i.name);
    expect(names).toContain('idx_sync_queue_status');
    expect(names).toContain('idx_ficha_updated_at');
  });
});