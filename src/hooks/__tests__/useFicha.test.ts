import { openDB, runMigrations } from '../../db/index';
import { loadFicha, saveFicha, deleteFicha, markFichaSynced } from '../../db/fichaStore';
import { createDebouncedSaver } from '../../lib/debounce';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DB } from '@op-engineering/op-sqlite';
import * as fs from 'fs';
import type { FichaAgente } from '../../shared/ordem/esquemas';

/**
 * Exercita a camada que o hook `useFicha` usa de fato (`src/db/fichaStore`), com um
 * banco SQLite real: é aí que está a lógica (consultas parametrizadas, upsert da ficha
 * e inserção na fila de sync). O hook só embrulha essas funções em estado React.
 */
describe('useFicha → fichaStore', () => {
  let db: DB;
  let tempDbPath: string;

  const campaignId = 'campaign-1';
  const userId = 'user-1';

  beforeEach(async () => {
    tempDbPath = `test_ficha_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
    db = await openDB(tempDbPath);
    await runMigrations(db);
  });

  afterEach(() => {
    if (db) db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const p = tempDbPath + suffix;
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    }
    vi.useRealTimers();
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

  async function countRows(table: string): Promise<number> {
    const res = await db.execute(`SELECT COUNT(*) as c FROM ${table}`);
    return Number((res.rows[0] as unknown as { c: number }).c);
  }

  it('não há ficha até salvar; saveFicha cria a ficha e enfileira um push_ficha', async () => {
    expect(await loadFicha(db, campaignId, userId)).toBeNull();

    await saveFicha(db, campaignId, userId, sampleFicha);

    const loaded = await loadFicha(db, campaignId, userId);
    expect(loaded).toEqual(sampleFicha);
    expect(await countRows('ficha')).toBe(1);

    const queue = await db.execute('SELECT * FROM sync_queue');
    expect(queue.rows.length).toBe(1);
    expect(queue.rows[0].operacao).toBe('push_ficha');
    expect(queue.rows[0].status).toBe('pending');
    expect(JSON.parse(queue.rows[0].payload as string).fichaId).toBeTruthy();
  });

  it('preserva valores com aspas (consulta parametrizada, sem escape manual)', async () => {
    const ficha: FichaAgente = { ...sampleFicha, jogador: "O'Brien — 'aspas'" };

    await saveFicha(db, campaignId, userId, ficha);

    const loaded = await loadFicha(db, campaignId, userId);
    expect(loaded?.jogador).toBe("O'Brien — 'aspas'");
  });

  it('não interpreta SQL vindo do usuário (injeção fica como texto)', async () => {
    const ficha: FichaAgente = { ...sampleFicha, jogador: "x'); DROP TABLE ficha;--" };

    await saveFicha(db, campaignId, userId, ficha);

    expect(await countRows('ficha')).toBe(1);
    expect((await loadFicha(db, campaignId, userId))?.jogador).toBe("x'); DROP TABLE ficha;--");
  });

  it('salvar de novo atualiza a mesma ficha e enfileira outro push_ficha', async () => {
    await saveFicha(db, campaignId, userId, sampleFicha);
    await saveFicha(db, campaignId, userId, { ...sampleFicha, nex: 15, pvAtual: 10 });

    expect(await countRows('ficha')).toBe(1); // upsert: continua uma só ficha por campanha/usuário
    const loaded = await loadFicha(db, campaignId, userId);
    expect(loaded?.nex).toBe(15);
    expect(loaded?.pvAtual).toBe(10);

    const queue = await db.execute('SELECT * FROM sync_queue');
    expect(queue.rows.length).toBe(2);
  });

  it('markFichaSynced grava synced_at', async () => {
    await saveFicha(db, campaignId, userId, sampleFicha);
    await markFichaSynced(db, campaignId, userId);

    const res = await db.execute('SELECT synced_at FROM ficha WHERE campaign_id = ? AND user_id = ?', [campaignId, userId]);
    expect(res.rows[0].synced_at).toBeTruthy();
  });

  it('deleteFicha remove a ficha', async () => {
    await saveFicha(db, campaignId, userId, sampleFicha);
    await deleteFicha(db, campaignId, userId);
    expect(await loadFicha(db, campaignId, userId)).toBeNull();
  });

  it('debounce: uma rajada de edições gera uma única gravação e uma linha de fila', async () => {
    vi.useFakeTimers();

    let calls = 0;
    const saver = createDebouncedSaver<FichaAgente>(async (f) => {
      calls += 1;
      await saveFicha(db, campaignId, userId, f);
    }, 600);

    for (let i = 0; i < 5; i++) {
      saver.schedule({ ...sampleFicha, nex: i * 5, jogador: `J${i}` });
    }
    expect(calls).toBe(0); // nada gravado durante a rajada

    await vi.advanceTimersByTimeAsync(600);
    await saver.flush();

    expect(calls).toBe(1); // uma edição (a última) → uma gravação
    expect((await loadFicha(db, campaignId, userId))?.jogador).toBe('J4');
    expect(await countRows('ficha')).toBe(1);
    expect(await countRows('sync_queue')).toBe(1);
  });

  it('debounce: flush grava imediatamente o pendente', async () => {
    let saved: FichaAgente | null = null;
    const saver = createDebouncedSaver<FichaAgente>((f) => { saved = f; }, 10_000);

    saver.schedule({ ...sampleFicha, jogador: 'Pending' });
    expect(saved).toBeNull();

    await saver.flush();
    expect((saved as FichaAgente | null)?.jogador).toBe('Pending');
  });
});
