import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getDB } from '../db';
import {
  loadFicha,
  saveFicha as persistFicha,
  deleteFicha as removeFicha,
  markFichaSynced,
} from '../db/fichaStore';
import { createDebouncedSaver, type DebouncedSaver } from '../lib/debounce';
import type { FichaAgente } from '../shared/ordem/esquemas';

export interface UseFichaResult {
  ficha: FichaAgente | null;
  loading: boolean;
  error: string | null;
  saveFicha: (ficha: FichaAgente) => Promise<void>;
  deleteFicha: () => Promise<void>;
  markSynced: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Ficha da campanha/usuário. As edições atualizam o estado na hora (digitação
 * responsiva) e a gravação no SQLite é debounced: uma rajada de teclas gera uma
 * única gravação e uma única linha em `sync_queue`. As pendências são gravadas
 * ao sair da tela (blur) e ao desmontar.
 */
export function useFicha(campaignId: string, userId: string): UseFichaResult {
  const [ficha, setFicha] = useState<FichaAgente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  // Contexto lido no momento da gravação (o saver é criado uma vez por montagem).
  const contextRef = useRef({ campaignId, userId });
  const saverRef = useRef<DebouncedSaver<FichaAgente> | null>(null);

  // Initialize refs in a useEffect to avoid ref access during render
  useEffect(() => {
    contextRef.current = { campaignId, userId };
    if (!saverRef.current) {
      saverRef.current = createDebouncedSaver<FichaAgente>(async (data) => {
        const ctx = contextRef.current;
        await persistFicha(db, ctx.campaignId, ctx.userId, data);
      });
    }
  }, [campaignId, userId, db]);

  const flush = useCallback(async () => {
    try {
      await saverRef.current?.flush();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save ficha');
    }
  }, []);

  const doRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await saverRef.current?.flush(); // grava pendências antes de ler
      setFicha(await loadFicha(db, campaignId, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ficha');
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

  // Grava as pendências ao sair da tela (blur) e ao desmontar.
  useFocusEffect(useCallback(() => () => { void flush(); }, [flush]));
  useEffect(() => () => { void flush(); }, [flush]);

  const saveFicha = useCallback(async (fichaData: FichaAgente) => {
    setError(null);
    setFicha(fichaData); // otimista: mantém a tela responsiva entre edições
    saverRef.current?.schedule(fichaData);
  }, []);

  const deleteFicha = useCallback(async () => {
    setError(null);
    try {
      saverRef.current?.cancel();
      await removeFicha(db, campaignId, userId);
      setFicha(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ficha');
      throw e;
    }
  }, [campaignId, userId, db]);

  const markSynced = useCallback(async () => {
    setError(null);
    try {
      await flush();
      await markFichaSynced(db, campaignId, userId);
      setFicha(await loadFicha(db, campaignId, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark ficha as synced');
      throw e;
    }
  }, [flush, campaignId, userId, db]);

  return {
    ficha,
    loading,
    error,
    saveFicha,
    deleteFicha,
    markSynced,
    refresh,
  };
}
