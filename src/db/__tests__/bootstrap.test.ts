import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'fs';

// Intercepta o driver para abrir um banco temporário em vez de magistrado.db no cwd,
// e para poder simular uma falha de abertura.
const state = vi.hoisted(() => ({ dbPath: '', failNextOpen: false }));

vi.mock('../driver', async importOriginal => {
  const actual = await importOriginal<typeof import('../driver')>();
  return {
    ...actual,
    openDriver: (options: { name: string; location?: string }) => {
      if (state.failNextOpen) {
        state.failNextOpen = false;
        throw new Error('falha simulada ao abrir o banco');
      }
      state.dbPath = `test_bootstrap_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
      return actual.openDriver({ ...options, name: state.dbPath });
    },
  };
});

import {
  ensureDatabaseReady,
  getDB,
  getDatabaseError,
  closeDB,
  DB_TABLES,
} from '../index';

describe('bootstrap do banco no boot', () => {
  afterEach(() => {
    closeDB();
    if (state.dbPath) {
      for (const suffix of ['', '-wal', '-shm']) {
        const p = state.dbPath + suffix;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      state.dbPath = '';
    }
  });

  async function tableNames(): Promise<string[]> {
    const res = await getDB().execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return res.rows.map(r => r.name as string);
  }

  it('prepara o banco: migra e semeia as regras', async () => {
    await ensureDatabaseReady();

    const tables = await tableNames();
    expect(tables).toContain('ficha');
    expect(tables).toContain('rolagens');

    const regras = await getDB().execute(`SELECT COUNT(*) as c FROM ${DB_TABLES.REGRAS}`);
    expect(Number(regras.rows[0].c)).toBeGreaterThan(0);
  });

  it('é idempotente: duas chamadas devolvem a mesma promise (uma execução)', async () => {
    const p1 = ensureDatabaseReady();
    const p2 = ensureDatabaseReady();
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
  });

  it('o gate impede consulta antes da hora: query disparada no boot não falha', async () => {
    // Nenhum ensureDatabaseReady() explícito: a query sozinha precisa disparar o boot.
    const result = await getDB().execute(`SELECT COUNT(*) as c FROM ${DB_TABLES.ROLAGENS}`);
    expect(Number(result.rows[0].c)).toBe(0);
  });

  it('expõe o erro do bootstrap e permite nova tentativa', async () => {
    state.failNextOpen = true;

    await expect(ensureDatabaseReady()).rejects.toThrow();
    expect(getDatabaseError()).toBeInstanceOf(Error);

    // retry precisa funcionar
    await ensureDatabaseReady();
    expect(getDatabaseError()).toBeNull();

    const tables = await tableNames();
    expect(tables).toContain('ficha');
  });
});
