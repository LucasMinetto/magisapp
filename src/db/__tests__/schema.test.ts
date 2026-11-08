import { openDB, runMigrations } from '../index';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';
import * as fs from 'fs';

describe('DB Schema v1', () => {
  let db: DB;
  let tempDbPath: string;
  
  beforeEach(async () => {
    // Use a temp file for tests that need WAL mode and proper PRAGMA support
    tempDbPath = `test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
    db = await openDB(tempDbPath);
    await runMigrations(db);
  });
  
  afterEach(() => {
    // Close database before cleaning up temp file
    if (db) {
      db.close();
    }
    // Clean up temp database file
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
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
      'rolagens',
    ].sort());
  });

  it('enforces foreign keys at connection level', async () => {
    // Verify FK enforcement works by attempting invalid insert (FK constraint)
    await expect(db.execute(
      "INSERT INTO arquivo_anotacao (id, campaign_id, user_id, titulo, conteudo, linked_pessoa_id, created_at, updated_at) VALUES ('fk_test', 'c1', 'u1', 'Test', 'Test', 'nonexistent', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
  });

  it('has WAL mode enabled', () => {
    // Verify WAL mode by checking for -wal file creation
    const walPath = tempDbPath + '-wal';
    expect(fs.existsSync(walPath)).toBe(true);
  });

  it('has all 6 indexes', async () => {
    const indexes = await db.execute('SELECT name FROM sqlite_master WHERE type=\'index\'');
    const names = indexes.rows.map(i => i.name);
    expect(names).toContain('idx_sync_queue_status');
    expect(names).toContain('idx_ficha_updated_at');
    expect(names).toContain('idx_bib_ritual_elemento_circulo');
    expect(names).toContain('idx_bib_item_tipo_categoria');
    expect(names).toContain('idx_anotacao_campaign_user');
    expect(names).toContain('idx_historico_campaign_user');
  });

  it('enforces both FKs on arquivo_anotacao', async () => {
    // linked_pessoa_id FK
    await expect(db.execute(
      "INSERT INTO arquivo_anotacao (id, campaign_id, user_id, titulo, conteudo, linked_pessoa_id, created_at, updated_at) VALUES ('a1', 'c1', 'u1', 'Test', 'Test', 'nonexistent', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
    // linked_lugar_id FK
    await expect(db.execute(
      "INSERT INTO arquivo_anotacao (id, campaign_id, user_id, titulo, conteudo, linked_lugar_id, created_at, updated_at) VALUES ('a2', 'c1', 'u1', 'Test', 'Test', 'nonexistent', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
  });

  it('constrains sync_queue.operacao to spec values', async () => {
    // Valid values should work
    await db.execute(
      "INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('s1', 'c1', 'u1', 'pull', '{}', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('s2', 'c1', 'u1', 'push_ficha', '{}', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('s3', 'c1', 'u1', 'push_rolagem', '{}', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('s4', 'c1', 'u1', 'push_anotacao', '{}', '2024-01-01T00:00:00Z')"
    );

    // Invalid value should fail
    await expect(db.execute(
      "INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('s5', 'c1', 'u1', 'invalid_op', '{}', '2024-01-01T00:01:00Z')"
    )).rejects.toThrow();
  });

  it('constrains auth.key pattern (current_user | token_<campaign_id>)', async () => {
    // Valid keys should work
    await db.execute(
      "INSERT INTO auth (key, value, updated_at) VALUES ('current_user', '{}', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO auth (key, value, updated_at) VALUES ('token_campaign123', '{}', '2024-01-01T00:00:00Z')"
    );

    // Invalid key should fail
    await expect(db.execute(
      "INSERT INTO auth (key, value, updated_at) VALUES ('invalid_key', '{}', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
  });

  it('constrains arquivo_historico.tipo to spec values', async () => {
    // Valid values should work
    await db.execute(
      "INSERT INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES ('h1', 'c1', 'u1', 'pessoa_v1', 'p1', 'Test', 'Test', 'mestre', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES ('h2', 'c1', 'u1', 'lugar_v2', 'l1', 'Test', 'Test', 'mestre', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES ('h3', 'c1', 'u1', 'interludio', 'i1', 'Test', 'Test', 'jogador', '2024-01-01T00:00:00Z')"
    );
    await db.execute(
      "INSERT INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES ('h4', 'c1', 'u1', 'anotacao', 'a1', 'Test', 'Test', 'jogador', '2024-01-01T00:00:00Z')"
    );

    // Invalid value should fail
    await expect(db.execute(
      "INSERT INTO arquivo_historico (id, campaign_id, user_id, tipo, ref_id, titulo, conteudo, autor, created_at) VALUES ('h5', 'c1', 'u1', 'invalid_tipo', 'x1', 'Test', 'Test', 'mestre', '2024-01-01T00:00:00Z')"
    )).rejects.toThrow();
  });
});
