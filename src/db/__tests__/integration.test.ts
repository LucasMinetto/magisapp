import { openDB, runMigrations, seedDatabase, DB_TABLES } from '../index';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';
import * as fs from 'fs';
import type { FichaAgente } from '../../shared/ordem/esquemas';

describe('Seed Data + Integration Test', () => {
  let db: DB;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = `test_integration_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
    db = await openDB(tempDbPath);
    await runMigrations(db);
  });

  afterEach(() => {
    if (db) db.close();
    if (tempDbPath && fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    if (tempDbPath && fs.existsSync(tempDbPath + '-wal')) fs.unlinkSync(tempDbPath + '-wal');
    if (tempDbPath && fs.existsSync(tempDbPath + '-shm')) fs.unlinkSync(tempDbPath + '-shm');
  });

  it('seeds 1 ficha, 3 rituais, 3 itens, 1 regra capítulo', async () => {
    await seedDatabase(db);

    // Verify ficha count
    const fichaResult = await db.execute(`SELECT * FROM ${DB_TABLES.FICHA}`);
    expect(fichaResult.rows.length).toBe(1);
    const ficha = JSON.parse(fichaResult.rows[0].sheet_data as string) as FichaAgente;
    expect(ficha.jogador).toBeDefined();
    expect(ficha.classe).toBeDefined();
    expect(ficha.atributos).toBeDefined();
    expect(ficha.pvMax).toBeGreaterThan(0);

    // Verify ritual count
    const ritualResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_RITUAL}`);
    expect(ritualResult.rows.length).toBe(3);
    for (const row of ritualResult.rows) {
      const ritual = row as unknown as RitualBibliotecaRow;
      expect(ritual.nome).toBeDefined();
      expect(ritual.elemento).toBeDefined();
      expect(ritual.circulo).toBeGreaterThanOrEqual(1);
      expect(ritual.circulo).toBeLessThanOrEqual(4);
      expect(ritual.source_id).toBeDefined();
    }

    // Verify item count
    const itemResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_ITEM}`);
    expect(itemResult.rows.length).toBe(3);
    for (const row of itemResult.rows) {
      const item = row as unknown as ItemBibliotecaRow;
      expect(item.nome).toBeDefined();
      expect(item.tipo).toBeDefined();
      expect(item.categoria).toBeGreaterThanOrEqual(0);
      expect(item.categoria).toBeLessThanOrEqual(4);
      expect(item.source_id).toBeDefined();
    }

    // Verify regra count
    const regraResult = await db.execute(`SELECT * FROM ${DB_TABLES.REGRAS}`);
    expect(regraResult.rows.length).toBe(1);
    const regra = regraResult.rows[0];
    expect(regra.capitulo).toBeDefined();
    expect(regra.titulo).toBeDefined();
    expect(regra.conteudo).toBeDefined();
    expect(regra.visivel_para_jogadores).toBe(1);
  });

  it('seed data has valid foreign key relationships and constraints', async () => {
    await seedDatabase(db);

    // Verify ficha unique constraint (campaign_id, user_id)
    const fichaResult = await db.execute(`SELECT * FROM ${DB_TABLES.FICHA}`);
    const ficha = fichaResult.rows[0];
    expect(ficha.campaign_id).toBeDefined();
    expect(ficha.user_id).toBeDefined();
    expect(ficha.updated_at).toBeDefined();
    expect(ficha.synced_at).toBeNull(); // Not synced yet

    // Verify ritual unique constraint (source_id, nome)
    const ritualResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_RITUAL}`);
    const ritualNames = new Set<string>();
    for (const row of ritualResult.rows) {
      const r = row as unknown as RitualBibliotecaRow;
      const key = `${r.source_id}|${r.nome}`;
      expect(ritualNames.has(key)).toBe(false);
      ritualNames.add(key);
    }

    // Verify item unique constraint (source_id, nome)
    const itemResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_ITEM}`);
    const itemNames = new Set<string>();
    for (const row of itemResult.rows) {
      const i = row as unknown as ItemBibliotecaRow;
      const key = `${i.source_id}|${i.nome}`;
      expect(itemNames.has(key)).toBe(false);
      itemNames.add(key);
    }

    // Verify regra unique constraint (capitulo)
    const regraResult = await db.execute(`SELECT * FROM ${DB_TABLES.REGRAS}`);
    const capitulos = new Set<number>();
    for (const row of regraResult.rows) {
      const capitulo = row.capitulo as number;
      expect(capitulos.has(capitulo)).toBe(false);
      capitulos.add(capitulo);
    }
  });

  it('seed data includes sync queue entries for ficha', async () => {
    await seedDatabase(db);

    const syncResult = await db.execute(
      `SELECT * FROM ${DB_TABLES.SYNC_QUEUE} WHERE operacao = 'push_ficha'`
    );
    expect(syncResult.rows.length).toBe(1);
    const syncEntry = syncResult.rows[0];
    expect(syncEntry.status).toBe('pending');
    expect(syncEntry.tentativas).toBe(0);
    expect(syncEntry.created_at).toBeDefined();
    expect(syncEntry.processed_at).toBeNull();

    // Verify payload references the ficha
    const payload = JSON.parse(syncEntry.payload as string);
    expect(payload.fichaId).toBeDefined();
  });

  it('seed data timestamps are valid ISO 8601 UTC strings', async () => {
    await seedDatabase(db);

    const tables = [
      DB_TABLES.FICHA,
      DB_TABLES.BIBLIOTECA_RITUAL,
      DB_TABLES.BIBLIOTECA_ITEM,
      DB_TABLES.REGRAS,
      DB_TABLES.SYNC_QUEUE,
    ];

    for (const table of tables) {
      const result = await db.execute(`SELECT * FROM ${table}`);
      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        // Check all timestamp columns
        for (const [key, value] of Object.entries(r)) {
          if (key.endsWith('_at') || key === 'data' || key === 'created_at' || key === 'updated_at' || key === 'synced_at' || key === 'processed_at') {
            if (value !== null && value !== undefined) {
              const date = new Date(value as string);
              expect(date.toISOString()).toBe(value); // Valid ISO 8601 UTC
              expect(date.getTime()).not.toBeNaN();
            }
          }
        }
      }
    }
  });

  it('seed is idempotent - running twice does not duplicate data', async () => {
    await seedDatabase(db);
    await seedDatabase(db);

    const fichaResult = await db.execute(`SELECT * FROM ${DB_TABLES.FICHA}`);
    expect(fichaResult.rows.length).toBe(1);

    const ritualResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_RITUAL}`);
    expect(ritualResult.rows.length).toBe(3);

    const itemResult = await db.execute(`SELECT * FROM ${DB_TABLES.BIBLIOTECA_ITEM}`);
    expect(itemResult.rows.length).toBe(3);

    const regraResult = await db.execute(`SELECT * FROM ${DB_TABLES.REGRAS}`);
    expect(regraResult.rows.length).toBe(1);
  });
});

// Type definitions matching the database schema
interface RitualBibliotecaRow {
  id: string;
  source_id: string;
  nome: string;
  elemento: string;
  circulo: number;
  execucao: string | null;
  alcance: string | null;
  alvo: string | null;
  duracao: string | null;
  resistencia: string | null;
  efeito: string | null;
  discente: string | null;
  verdadeiro: string | null;
  dano_normal: string | null;
  dano_discente: string | null;
  dano_verdadeiro: string | null;
  tipo_dano: string | null;
  alvo_tipo: string | null;
  pagina: number | null;
  data: string;
  synced_at: string | null;
}

interface ItemBibliotecaRow {
  id: string;
  source_id: string;
  nome: string;
  tipo: string;
  categoria: number;
  espacos: number;
  defesa: number;
  dano: string | null;
  tipo_dano: string | null;
  critico: string | null;
  alcance: string | null;
  proficiencia: string | null;
  empunhadura: string | null;
  elemento: string | null;
  descricao: string | null;
  quantidade: number;
  pagina: number | null;
  data: string;
  synced_at: string | null;
}