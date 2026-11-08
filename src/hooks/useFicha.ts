import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';
import type { FichaAgente } from '../shared/ordem/esquemas';
import { v4 as uuidv4 } from 'uuid';

export interface UseFichaResult {
  ficha: FichaAgente | null;
  loading: boolean;
  error: string | null;
  saveFicha: (ficha: FichaAgente) => Promise<void>;
  deleteFicha: () => Promise<void>;
  markSynced: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface FichaRow {
  id: string;
  campaign_id: string;
  user_id: string;
  sheet_data: string;
  updated_at: string;
  synced_at: string | null;
}

function rowToFicha(row: FichaRow): FichaAgente {
  return JSON.parse(row.sheet_data);
}

export function useFicha(campaignId: string, userId: string): UseFichaResult {
  const [ficha, setFicha] = useState<FichaAgente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await db.execute(
        `SELECT * FROM ficha WHERE campaign_id = '${campaignId}' AND user_id = '${userId}'`
      );
      if (result.rows.length > 0) {
        setFicha(rowToFicha(result.rows[0] as unknown as FichaRow));
      } else {
        setFicha(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ficha');
    } finally {
      setLoading(false);
    }
  }, [campaignId, userId, db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveFicha = useCallback(async (fichaData: FichaAgente) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const fichaId = uuidv4();
      const sheetData = JSON.stringify(fichaData).replace(/'/g, "''");

      // Check if ficha exists
      const existing = await db.execute(
        `SELECT id FROM ficha WHERE campaign_id = '${campaignId}' AND user_id = '${userId}'`
      );

      if (existing.rows.length > 0) {
        // Update existing
        const existingId = (existing.rows[0] as unknown as { id: string }).id;
        await db.execute(
          `UPDATE ficha SET sheet_data = '${sheetData}', updated_at = '${now}' WHERE id = '${existingId}'`
        );
      } else {
        // Insert new
        await db.execute(
          `INSERT INTO ficha (id, campaign_id, user_id, sheet_data, updated_at) VALUES ('${fichaId}', '${campaignId}', '${userId}', '${sheetData}', '${now}')`
        );
      }

      // Add to sync queue
      const syncId = uuidv4();
      const targetFichaId = existing.rows.length > 0 ? (existing.rows[0] as unknown as { id: string }).id : fichaId;
      await db.execute(
        `INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, created_at) VALUES ('${syncId}', '${campaignId}', '${userId}', 'push_ficha', '${JSON.stringify({ fichaId: targetFichaId }).replace(/'/g, "''")}', '${now}')`
      );

      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save ficha');
      throw e;
    }
  }, [campaignId, userId, db, refresh]);

  const deleteFicha = useCallback(async () => {
    setError(null);
    try {
      const result = await db.execute(
        `SELECT id FROM ficha WHERE campaign_id = '${campaignId}' AND user_id = '${userId}'`
      );
      if (result.rows.length > 0) {
        const fichaId = (result.rows[0] as unknown as { id: string }).id;
        await db.execute(`DELETE FROM ficha WHERE id = '${fichaId}'`);
        setFicha(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ficha');
      throw e;
    }
  }, [campaignId, userId, db]);

  const markSynced = useCallback(async () => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const result = await db.execute(
        `SELECT id FROM ficha WHERE campaign_id = '${campaignId}' AND user_id = '${userId}'`
      );
      if (result.rows.length > 0) {
        const fichaId = (result.rows[0] as unknown as { id: string }).id;
        await db.execute(`UPDATE ficha SET synced_at = '${now}' WHERE id = '${fichaId}'`);
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark ficha as synced');
      throw e;
    }
  }, [campaignId, userId, db, refresh]);

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