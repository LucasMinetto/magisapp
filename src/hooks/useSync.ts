/**
 * Hook de sincronização: estado de conexão (online/offline/syncing),
 * pull/push manual e auto-sync quando online.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth';
import { useSyncQueue, type SyncOperacao } from './useSyncQueue';
import { getSyncEngine, SyncEngine, type SyncState } from '../api/sync';
import { useAuthDB } from './useAuthDB';

export interface UseSyncResult {
  state: SyncState;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  sync: () => Promise<void>;
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  enqueueChange: (operacao: SyncOperacao, payload: unknown) => Promise<void>;
}

export function useSync(campaignId?: string, userId?: string): UseSyncResult {
  const { user, token } = useAuth();
  const { syncCredentials } = useAuthDB();
  const effectiveCampaignId = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const effectiveUserId = userId ?? user?.id ?? 'user-1';
  const serverUrl = syncCredentials?.serverUrl ?? '';
  const syncEngine = getSyncEngine();

  // Use hooks at top level
  const { enqueue } = useSyncQueue(effectiveCampaignId, effectiveUserId);
  
  const [state, setState] = useState<SyncState>(syncEngine.getState());
  const [isOnline, setIsOnline] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to sync engine state changes
  useEffect(() => {
    if (!effectiveCampaignId || !effectiveUserId || !serverUrl) return;

    syncEngine.configure(effectiveCampaignId, effectiveUserId, serverUrl, token);
    unsubscribeRef.current = syncEngine.subscribe(setState);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [effectiveCampaignId, effectiveUserId, serverUrl, token]);

  // Auto-sync when online and pending changes
  useEffect(() => {
    if (isOnline && state.status === 'online' && state.pendingCount > 0) {
      syncEngine.sync();
    }
  }, [isOnline, state.status, state.pendingCount]);

  // Listen to network status (simplified - in production use @react-native-community/netinfo)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const pull = useCallback(async () => {
    await syncEngine.pull();
  }, []);

  const push = useCallback(async () => {
    await syncEngine.push();
  }, []);

  const sync = useCallback(async () => {
    await syncEngine.sync();
  }, []);

  const setOnline = useCallback((online: boolean) => {
    setIsOnline(online);
    syncEngine.setOnlineState(online);
  }, []);

  const enqueueChange = useCallback(async (operacao: SyncOperacao, payload: unknown) => {
    await enqueue(operacao, payload);
  }, [enqueue]);

  return {
    state,
    pull,
    push,
    sync,
    isOnline,
    setOnline,
    enqueueChange,
  };
}

// Export for direct engine access if needed
export { getSyncEngine, SyncEngine } from '../api/sync';