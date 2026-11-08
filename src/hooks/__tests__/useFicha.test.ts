import { openDB, runMigrations } from '../../db/index';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';
import * as fs from 'fs';
import type { FichaAgente } from '../../shared/ordem/esquemas';

describe('useFicha hook', () => {
  let db: DB;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = `test_ficha_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
    db = await openDB(tempDbPath);
    await runMigrations(db);
  });

  afterEach(() => {
    if (db) db.close();
    if (tempDbPath && fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    if (tempDbPath && fs.existsSync(tempDbPath + '-wal')) fs.unlinkSync(tempDbPath + '-wal');
    if (tempDbPath && fs.existsSync(tempDbPath + '-shm')) fs.unlinkSync(tempDbPath + '-shm');
  });

  const sampleFicha: FichaAgente = {
    jogador: 'Test Player',
    origem: 'Acadêmico',
    classe: 'Especialista',
    trilha: 'Investigação',
    nex: 10,
    estagio: 2,
    prestigio: 5,
    atributos: { agi: 2, for: 1, int: 3, pre: 2, vig: 2 },
    pericias: {
      Investigação: { treino: 2, extra: 1 },
      Luta: { treino: 1, extra: 0 },
    },
    bonus: { pv: 0, pe: 0, san: 0, defesaEquip: 0, defesaOutros: 0, deslocamento: 0 },
    pvMax: 15, peMax: 10, sanMax: 12, defesa: 12,
    pvAtual: 15, peAtual: 10, sanAtual: 12,
    pvTemp: 0, peTemp: 0, sanTemp: 0,
    condicoes: [],
    dadosFisicos: false,
    ataques: [],
    rituais: [],
    habilidades: [],
    inventario: [],
    investigacao: { aparencia: '', personalidade: '', historico: '', objetivo: '', anotacoes: '' },
  };

  const escape = (str: string) => str.replace(/'/g, "''");

  it('creates a ficha and adds to sync queue', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const fichaId = 'ficha-1';
    const now = new Date().toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    const result = await db.execute(`SELECT * FROM ficha WHERE id = '${fichaId}'`);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].campaign_id).toBe(campaignId);
    expect(result.rows[0].user_id).toBe(userId);
    expect(JSON.parse(result.rows[0].sheet_data as string)).toEqual(sampleFicha);
    expect(result.rows[0].synced_at).toBeNull();

    const syncId = 'sync-1';
    await db.execute(
      `INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('${syncId}', '${campaignId}', '${userId}', 'push_ficha', '${escape(JSON.stringify({ fichaId }))}', '${now}')`
    );

    const syncResult = await db.execute(`SELECT * FROM sync_queue WHERE id = '${syncId}'`);
    expect(syncResult.rows.length).toBe(1);
    expect(syncResult.rows[0].operacao).toBe('push_ficha');
    expect(syncResult.rows[0].status).toBe('pending');
  });

  it('reads ficha by campaign and user', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const fichaId = 'ficha-1';
    const now = new Date().toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    const result = await db.execute(
      `SELECT * FROM ficha WHERE campaign_id = '${campaignId}' AND user_id = '${userId}'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe(fichaId);
  });

  it('updates ficha and adds to sync queue', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const fichaId = 'ficha-1';
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 1000).toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    const updatedFicha = { ...sampleFicha, nex: 15, pvAtual: 10 };
    const updatedSheetData = escape(JSON.stringify(updatedFicha));

    await db.execute(
      `UPDATE ficha SET sheet_data = '${updatedSheetData}', updated_at = '${later}' WHERE id = '${fichaId}'`
    );

    const result = await db.execute(`SELECT * FROM ficha WHERE id = '${fichaId}'`);
    expect(JSON.parse(result.rows[0].sheet_data as string).nex).toBe(15);
    expect(JSON.parse(result.rows[0].sheet_data as string).pvAtual).toBe(10);
    expect(result.rows[0].updated_at).toBe(later);

    const syncId = 'sync-2';
    await db.execute(
      `INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('${syncId}', '${campaignId}', '${userId}', 'push_ficha', '${escape(JSON.stringify({ fichaId }))}', '${later}')`
    );

    const syncResult = await db.execute(`SELECT * FROM sync_queue WHERE id = '${syncId}'`);
    expect(syncResult.rows[0].operacao).toBe('push_ficha');
  });

  it('deletes ficha', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const fichaId = 'ficha-1';
    const now = new Date().toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    await db.execute(`DELETE FROM ficha WHERE id = '${fichaId}'`);

    const result = await db.execute(`SELECT * FROM ficha WHERE id = '${fichaId}'`);
    expect(result.rows.length).toBe(0);
  });

  it('marks ficha as synced', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const fichaId = 'ficha-1';
    const now = new Date().toISOString();
    const syncedAt = new Date(Date.now() + 1000).toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    await db.execute(`UPDATE ficha SET synced_at = '${syncedAt}' WHERE id = '${fichaId}'`);

    const result = await db.execute(`SELECT * FROM ficha WHERE id = '${fichaId}'`);
    expect(result.rows[0].synced_at).toBe(syncedAt);
  });

  it('enforces unique constraint on (campaign_id, user_id)', async () => {
    const campaignId = 'campaign-1';
    const userId = 'user-1';
    const now = new Date().toISOString();
    const sheetData = escape(JSON.stringify(sampleFicha));

    await db.execute(
      `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('ficha-1', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
    );

    await expect(
      db.execute(
        `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('ficha-2', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
      )
    ).rejects.toThrow();
  });
});