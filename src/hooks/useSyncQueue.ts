import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';
import { v4 as uuidv4 } from 'uuid';

export type SyncOperacao = 'pull' | 'push_ficha' | 'push_rolagem' | 'push_anotacao';
export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed';

export interface SyncQueueRow {
  id: string;
  campaign_id: string;
  user_id: string;
  operacao: SyncOperacao;
  payload: string;
  status: SyncStatus;
  tentativas: number;
  created_at: string;
  processed_at: string | null;
  error: string | null;
}

export interface SyncQueueEntry {
  id: string;
  campaignId: string;
  userId: string;
  operacao: SyncOperacao;
  payload: unknown;
  status: SyncStatus;
  tentativas: number;
  createdAt: string;
  processedAt: string | null;
  error: string | null;
}

export interface UseSyncQueueResult {
  queue: SyncQueueEntry[];
  pendingCount: number;
  loading: boolean;
  error: string | null;
  enqueue: (operacao: SyncOperacao, payload: unknown) => Promise<SyncQueueEntry>;
  markProcessing: (id: string) => Promise<void>;
  markSynced: (id: string) => Promise<void>;
  markFailed: (id: string, error: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function rowToEntry(row: Record<string, unknown>): SyncQueueEntry {
  const r = row as unknown as SyncQueueRow;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    userId: r.user_id,
    operacao: r.operacao,
    payload: JSON.parse(r.payload),
    status: r.status,
    tentativas: r.tentativas,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    error: r.error,
  };
}

export function useSyncQueue(campaignId: string, userId: string): UseSyncQueueResult {
  const [queue, setQueue] = useState<SyncQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await db.execute(
        'SELECT * FROM sync_queue WHERE campaign_id = ? AND user_id = ? ORDER BY created_at ASC',
        [campaignId, userId]
      );
      setQueue(result.rows.map(rowToEntry));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sync queue');
    } finally {
      setLoading(false);
    }
  }, [campaignId, userId, db]);

  useEffect(() => {
    Promise.resolve().then(() => refresh());
  }, [refresh]);

  const enqueue = useCallback(async (operacao: SyncOperacao, payload: unknown): Promise<SyncQueueEntry> => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const id = uuidv4();

      await db.execute(
        `INSERT INTO sync_queue (id, campaign_id, user_id, operacao, payload, status, tentativas, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
        [id, campaignId, userId, operacao, JSON.stringify(payload), now]
      );

      await refresh();
      const entry = queue.find(q => q.id === id);
      if (!entry) throw new Error('Sync entry not found after enqueue');
      return entry;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enqueue sync operation');
      throw e;
    }
  }, [campaignId, userId, db, refresh, queue]);

  const markProcessing = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(`UPDATE sync_queue SET status = 'processing' WHERE id = ?`, [id]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as processing');
      throw e;
    }
  }, [db, refresh]);

  const markSynced = useCallback(async (id: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      await db.execute(`UPDATE sync_queue SET status = 'synced', processed_at = ? WHERE id = ?`, [now, id]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as synced');
      throw e;
    }
  }, [db, refresh]);

  const markFailed = useCallback(async (id: string, errorMsg: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      await db.execute(
        `UPDATE sync_queue SET status = 'failed', processed_at = ?, error = ?, tentativas = tentativas + 1 WHERE id = ?`,
        [now, errorMsg, id]
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as failed');
      throw e;
    }
  }, [db, refresh]);

  const retry = useCallback(async (id: string) => {
    setError(null);
    try {
      await db.execute(
        `UPDATE sync_queue SET status = 'pending', error = NULL, tentativas = tentativas + 1 WHERE id = ?`,
        [id]
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry');
      throw e;
    }
  }, [db, refresh]);

  const pendingCount = queue.filter(q => q.status === 'pending').length;

  return {
    queue,
    pendingCount,
    loading,
    error,
    enqueue,
    markProcessing,
    markSynced,
    markFailed,
    retry,
    refresh,
  };
}
