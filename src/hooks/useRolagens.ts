/**
 * Hook para CRUD de rolagens locais + push para fila de sync.
 * Persiste no SQLite (tabela rolagens) e enfileira para sincronização.
 */

import { useCallback, useEffect, useState } from 'react';
import { getDB, ensureDatabaseReady } from '../db';
import { useSyncQueue, type SyncOperacao } from './useSyncQueue';
import { v4 as uuidv4 } from 'uuid';
import { lerExpressao, rolarExpressao, dadosDoTeste, resolverTeste, resolverDano, type ExpressaoDano, type ResultadoTeste } from '../shared/ordem/regras';

export interface RolagemRow {
  id: string;
  campaign_id: string;
  user_id: string;
  tipo: 'teste' | 'ataque' | 'dano' | 'ritual' | 'livre';
  rotulo: string | null;
  formula: string;
  dados: string; // JSON array
  total: number;
  critico: number;
  falha: number;
  created_at: string;
  synced_at: string | null;
}

export interface Rolagem {
  id: string;
  campaignId: string;
  userId: string;
  tipo: 'teste' | 'ataque' | 'dano' | 'ritual' | 'livre';
  rotulo: string | null;
  formula: string;
  dados: number[];
  total: number;
  critico: boolean;
  falha: boolean;
  createdAt: string;
  syncedAt: string | null;
}

export interface UseRolagensResult {
  rolagens: Rolagem[];
  loading: boolean;
  error: string | null;
  rolarTeste: (params: { atributo: 'agi' | 'for' | 'int' | 'pre' | 'vig'; valorAtributo: number; bonus: number; dadosExtras?: number; rotulo?: string }) => Promise<Rolagem>;
  rolarAtaque: (params: { bonusAtaque: number; dano: string; tipoDano: string; margemCritico?: number; multCritico?: number; rotulo?: string }) => Promise<Rolagem>;
  rolarDano: (params: { expressao: string; multiplicador?: number; bonusExtra?: number; rotulo?: string }) => Promise<Rolagem>;
  rolarRitual: (params: { bonusOcultismo: number; rotulo?: string }) => Promise<Rolagem>;
  rolarIniciativa: (params: { agi: number; nome: string }) => Promise<Rolagem>;
  rolarLivre: (params: { formula: string; rotulo?: string }) => Promise<Rolagem>;
  deleteRolagem: (id: string) => Promise<void>;
  clearHistorico: () => Promise<void>;
  refresh: () => Promise<void>;
}

function rowToRolagem(row: Record<string, unknown>): Rolagem {
  const r = row as unknown as RolagemRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    tipo: r.tipo,
    rotulo: r.rotulo,
    formula: r.formula,
    dados: JSON.parse(r.dados),
    total: r.total,
    critico: r.critico === 1,
    falha: r.falha === 1,
    createdAt: r.created_at,
    syncedAt: r.synced_at,
  };
}

export function useRolagens(campaignId: string, userId: string): UseRolagensResult {
  const [rolagens, setRolagens] = useState<Rolagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();
  const { enqueue } = useSyncQueue(campaignId, userId);

  const doRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureDatabaseReady();
      const result = await db.execute(
        `SELECT * FROM rolagens WHERE campaign_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 200`,
        [campaignId, userId]
      );
      setRolagens(result.rows.map(rowToRolagem));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rolagens');
    } finally {
      setLoading(false);
    }
  }, [campaignId, userId, db]);

  const refresh = useCallback(async () => {
    // Schedule state updates as microtasks to avoid "setState in effect" warnings
    await Promise.resolve();
    await doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    Promise.resolve().then(() => doRefresh());
  }, [doRefresh]);

  const saveRolagem = useCallback(async (rolagem: Omit<Rolagem, 'id' | 'createdAt' | 'syncedAt'>): Promise<Rolagem> => {
    setError(null);
    try {
      await ensureDatabaseReady();
      const now = new Date().toISOString();
      const id = uuidv4();

      await db.execute(
        `INSERT INTO rolagens (id, campaign_id, user_id, tipo, rotulo, formula, dados, total, critico, falha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          campaignId,
          userId,
          rolagem.tipo,
          rolagem.rotulo ?? null,
          rolagem.formula,
          JSON.stringify(rolagem.dados),
          rolagem.total,
          rolagem.critico ? 1 : 0,
          rolagem.falha ? 1 : 0,
          now,
        ]
      );

      // Enfileira para sync
      await enqueue('push_rolagem', {
        entityType: 'rolagem',
        operation: 'create',
        entityId: id,
        data: rolagem,
        timestamp: now,
        version: 1,
      });

      // Refresh after save - schedule as microtask to avoid "setState in effect" warnings
      await Promise.resolve();
      await doRefresh();
      const saved = rolagens.find(r => r.id === id);
      if (!saved) throw new Error('Rolagem not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save rolagem');
      throw e;
    }
  }, [campaignId, userId, db, enqueue, rolagens, doRefresh]);

  // --- Teste de perícia/atributo ---
  const rolarTeste = useCallback(async (params: {
    atributo: 'agi' | 'for' | 'int' | 'pre' | 'vig';
    valorAtributo: number;
    bonus: number;
    dadosExtras?: number;
    rotulo?: string;
  }): Promise<Rolagem> => {
    const { dadosDoTeste, resolverTeste, rolarDados } = await import('../shared/ordem/regras');

    const { quantidade, regra } = dadosDoTeste(params.valorAtributo, params.dadosExtras ?? 0);
    const valores = rolarDados(quantidade, 20);
    const resultado = resolverTeste(valores, regra, params.bonus);

    const formula = `${quantidade}d20 (${regra === 'maior' ? 'maior' : 'menor'}) + ${params.bonus}`;
    const rotulo = params.rotulo ?? `${params.atributo.toUpperCase()} (${params.valorAtributo})`;

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'teste',
      rotulo,
      formula,
      dados: valores,
      total: resultado.total,
      critico: resultado.critico,
      falha: resultado.natural20 === false && resultado.escolhido === 1,
    });
  }, [campaignId, userId, saveRolagem]);

  // --- Ataque ---
  const rolarAtaque = useCallback(async (params: {
    bonusAtaque: number;
    dano: string;
    tipoDano: string;
    margemCritico?: number;
    multCritico?: number;
    rotulo?: string;
  }): Promise<Rolagem> => {
    const { rolarDado, lerExpressao, rolarExpressao, resolverDano, faixaSoma } = await import('../shared/ordem/regras');

    const d20 = rolarDado(20);
    const critico = d20 >= (params.margemCritico ?? 20);
    const acerto = d20 !== 1 && (critico || d20 + params.bonusAtaque >= 10); // Defesa base 10, ajuste conforme necessário

    let totalDano = 0;
    let dadosDano: number[] = [];
    let formulaDano = '';

    if (acerto) {
      const expr = lerExpressao(params.dano);
      const multiplicador = critico ? (params.multCritico ?? 2) : 1;
      const rolados = rolarExpressao(expr, multiplicador);
      dadosDano = rolados.flat();
      totalDano = resolverDano(expr, rolados, multiplicador);
      formulaDano = `${params.dano} × ${multiplicador}`;
    }

    const formula = `1d20+${params.bonusAtaque} → ${acerto ? formulaDano : 'errou'}`;
    const rotulo = params.rotulo ?? 'Ataque';

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'ataque',
      rotulo,
      formula,
      dados: [d20, ...dadosDano],
      total: totalDano,
      critico,
      falha: d20 === 1,
    });
  }, [campaignId, userId, saveRolagem]);

  // --- Dano livre ---
  const rolarDano = useCallback(async (params: {
    expressao: string;
    multiplicador?: number;
    bonusExtra?: number;
    rotulo?: string;
  }): Promise<Rolagem> => {
    const { lerExpressao, rolarExpressao, resolverDano } = await import('../shared/ordem/regras');

    const expr = lerExpressao(params.expressao);
    const mult = params.multiplicador ?? 1;
    const rolados = rolarExpressao(expr, mult);
    const dados = rolados.flat();
    const total = resolverDano(expr, rolados, mult, params.bonusExtra ?? 0);

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'dano',
      rotulo: params.rotulo ?? 'Dano',
      formula: `${params.expressao}${mult > 1 ? ` × ${mult}` : ''}${params.bonusExtra ? ` + ${params.bonusExtra}` : ''}`,
      dados,
      total,
      critico: false,
      falha: false,
    });
  }, [campaignId, userId, saveRolagem]);

  // --- Ritual ---
  const rolarRitual = useCallback(async (params: {
    bonusOcultismo: number;
    rotulo?: string;
  }): Promise<Rolagem> => {
    const { dadosDoTeste, resolverTeste, rolarDados } = await import('../shared/ordem/regras');

    // Teste de Ocultismo usa Intelecto (INT)
    const { quantidade, regra } = dadosDoTeste(0, 0); // Será ajustado pelo bonus
    const valores = rolarDados(quantidade > 0 ? quantidade : 1, 20);
    const resultado = resolverTeste(valores, 'maior', params.bonusOcultismo);

    const formula = `1d20+${params.bonusOcultismo} (Ocultismo)`;
    const rotulo = params.rotulo ?? 'Ritual';

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'ritual',
      rotulo,
      formula,
      dados: valores,
      total: resultado.total,
      critico: resultado.critico,
      falha: resultado.escolhido === 1,
    });
  }, [campaignId, userId, saveRolagem]);

  // --- Iniciativa ---
  const rolarIniciativa = useCallback(async (params: {
    agi: number;
    nome: string;
  }): Promise<Rolagem> => {
    const { rolarDado } = await import('../shared/ordem/regras');

    const d20 = rolarDado(20);
    const total = d20 + params.agi;

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'livre',
      rotulo: `Iniciativa: ${params.nome}`,
      formula: `1d20+${params.agi}`,
      dados: [d20],
      total,
      critico: d20 === 20,
      falha: d20 === 1,
    });
  }, [campaignId, userId, saveRolagem]);

  // --- Livre ---
  const rolarLivre = useCallback(async (params: {
    formula: string;
    rotulo?: string;
  }): Promise<Rolagem> => {
    const { lerExpressao, rolarExpressao, resolverDano } = await import('../shared/ordem/regras');

    const expr = lerExpressao(params.formula);
    const rolados = rolarExpressao(expr, 1);
    const dados = rolados.flat();
    const total = resolverDano(expr, rolados, 1, 0);

    return saveRolagem({
      campaignId,
      userId,
      tipo: 'livre',
      rotulo: params.rotulo ?? 'Livre',
      formula: params.formula,
      dados,
      total,
      critico: dados.some(d => d === 20),
      falha: dados.length === 1 && dados[0] === 1,
    });
  }, [campaignId, userId, saveRolagem]);

  const deleteRolagem = useCallback(async (id: string) => {
    setError(null);
    try {
      await ensureDatabaseReady();
      await db.execute(`DELETE FROM rolagens WHERE id = ?`, [id]);
      setRolagens(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete rolagem');
      throw e;
    }
  }, [db]);

  const clearHistorico = useCallback(async () => {
    setError(null);
    try {
      await ensureDatabaseReady();
      await db.execute(`DELETE FROM rolagens WHERE campaign_id = ? AND user_id = ?`, [campaignId, userId]);
      setRolagens([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear histórico');
      throw e;
    }
  }, [campaignId, userId, db]);

  return {
    rolagens,
    loading,
    error,
    rolarTeste,
    rolarAtaque,
    rolarDano,
    rolarRitual,
    rolarIniciativa,
    rolarLivre,
    deleteRolagem,
    clearHistorico,
    refresh,
  };
}