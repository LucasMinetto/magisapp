import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface RegraRow {
  id: string;
  capitulo: number;
  titulo: string;
  conteudo: string;
  pagina_livro: number | null;
  visivel_para_jogadores: number;
  updated_at: string;
}

export interface Regra {
  id: string;
  capitulo: number;
  titulo: string;
  conteudo: string;
  paginaLivro: number | null;
  visivelParaJogadores: boolean;
  updatedAt: string;
}

export interface UseRegrasResult {
  regras: Regra[];
  loading: boolean;
  error: string | null;
  saveRegra: (regra: Omit<Regra, 'id' | 'updatedAt'>) => Promise<Regra>;
  updateRegra: (id: string, regra: Partial<Omit<Regra, 'id' | 'updatedAt'>>) => Promise<Regra>;
  deleteRegra: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function rowToRegra(row: Record<string, unknown>): Regra {
  const r = row as unknown as RegraRow;
  return {
    id: r.id,
    capitulo: r.capitulo,
    titulo: r.titulo,
    conteudo: r.conteudo,
    paginaLivro: r.pagina_livro,
    visivelParaJogadores: r.visivel_para_jogadores === 1,
    updatedAt: r.updated_at,
  };
}

function regraToRow(regra: Partial<Omit<Regra, 'id' | 'updatedAt'>>): Partial<Omit<RegraRow, 'id' | 'updated_at'>> {
  const row: Partial<Omit<RegraRow, 'id' | 'updated_at'>> = {};
  if (regra.capitulo !== undefined) row.capitulo = regra.capitulo;
  if (regra.titulo !== undefined) row.titulo = regra.titulo;
  if (regra.conteudo !== undefined) row.conteudo = regra.conteudo;
  if (regra.paginaLivro !== undefined) row.pagina_livro = regra.paginaLivro;
  if (regra.visivelParaJogadores !== undefined) row.visivel_para_jogadores = regra.visivelParaJogadores ? 1 : 0;
  return row;
}

export function useRegras(): UseRegrasResult {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const doRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await db.execute(
        `SELECT * FROM regras ORDER BY capitulo`
      );
      setRegras(result.rows.map(rowToRegra));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load regras');
    } finally {
      setLoading(false);
    }
  }, [db]);

  const refresh = useCallback(async () => {
    // Schedule state updates as microtasks to avoid "setState in effect" warnings
    await Promise.resolve();
    await doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    Promise.resolve().then(() => doRefresh());
  }, [doRefresh]);

  const saveRegra = useCallback(async (regra: Omit<Regra, 'id' | 'updatedAt'>): Promise<Regra> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();
      const row = regraToRow(regra) as Record<string, unknown>;
      const cols = ['capitulo', 'titulo', 'conteudo', 'pagina_livro', 'visivel_para_jogadores'];
      const values = cols.map(c => row[c] as string | number | null);

      await db.execute(
        `INSERT INTO regras (id, ${cols.join(', ')}, updated_at) VALUES (?, ${cols.map(() => '?').join(', ')}, ?)`,
        [id, ...values, now]
      );

      // Refresh after save - schedule as microtask to avoid "setState in effect" warnings
      await Promise.resolve();
      await doRefresh();
      const saved = regras.find(r => r.id === id);
      if (!saved) throw new Error('Regra not found after save');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save regra');
      throw e;
    }
  }, [db, regras, doRefresh]);

  const updateRegra = useCallback(async (id: string, regra: Partial<Omit<Regra, 'id' | 'updatedAt'>>): Promise<Regra> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const row = regraToRow(regra) as Record<string, unknown>;
      const keys = Object.keys(row);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => row[k] as string | number | null);

      await db.execute(
        `UPDATE regras SET ${setClause}, updated_at = ? WHERE id = ?`,
        [...values, now, id]
      );

      // Refresh after update - schedule as microtask to avoid "setState in effect" warnings
      await Promise.resolve();
      await doRefresh();
      const saved = regras.find(r => r.id === id);
      if (!saved) throw new Error('Regra not found after update');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update regra');
      throw e;
    }
  }, [db, regras, doRefresh]);

  const deleteRegra = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`DELETE FROM regras WHERE id = ?`, [id]);
      setRegras(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete regra');
      throw e;
    }
  }, [db]);

  return {
    regras,
    loading,
    error,
    saveRegra,
    updateRegra,
    deleteRegra,
    refresh,
  };
}
