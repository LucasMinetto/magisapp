/**
 * Auth DB Store (Zustand) - persistência de credenciais, tokens e usuário no SQLite.
 * Substitui o hook useAuthDB por um store global acessível fora de componentes React.
 */

import { create } from 'zustand';
import { getDB, ensureDatabaseReady } from '../db';
import { toBase64 } from '../lib/base64';
import { timeoutSignal } from '../lib/timeout';

export interface AuthRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
}

export interface CampaignToken {
  campaignId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface SyncCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

interface AuthDBState {
  currentUser: CurrentUser | null;
  tokens: Map<string, CampaignToken>;
  syncCredentials: SyncCredentials | null;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  setCurrentUser: (user: CurrentUser | null) => Promise<void>;
  getToken: (campaignId: string) => CampaignToken | null;
  setToken: (campaignId: string, token: CampaignToken) => Promise<void>;
  deleteToken: (campaignId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  saveCredentials: (credentials: SyncCredentials) => Promise<void>;
  getCredentials: () => SyncCredentials | null;
  testConnection: (credentials?: SyncCredentials) => Promise<boolean>;
}

function parseCurrentUser(value: string): CurrentUser | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseToken(value: string): CampaignToken | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseCredentials(value: string): SyncCredentials | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const useAuthDB = create<AuthDBState>()((set, get) => ({
  currentUser: null,
  tokens: new Map<string, CampaignToken>(),
  syncCredentials: null,
  loading: true,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      const result = await db.execute(`SELECT * FROM auth`);
      const newTokens = new Map<string, CampaignToken>();
      let user: CurrentUser | null = null;
      let creds: SyncCredentials | null = null;

      for (const row of result.rows) {
        const r = row as unknown as AuthRow;
        if (r.key === 'current_user') {
          user = parseCurrentUser(r.value);
        } else if (r.key.startsWith('token_')) {
          const campaignId = r.key.slice(6);
          const token = parseToken(r.value);
          if (token) {
            newTokens.set(campaignId, token);
          }
        } else if (r.key === 'sync_credentials') {
          creds = parseCredentials(r.value);
        }
      }

      set({ currentUser: user, tokens: newTokens, syncCredentials: creds });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load auth data' });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentUser: async (user: CurrentUser | null) => {
    set({ error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      const now = new Date().toISOString();
      if (user) {
        await db.execute(
          `INSERT OR REPLACE INTO auth (key, value, updated_at) VALUES (?, ?, ?)`,
          ['current_user', JSON.stringify(user), now]
        );
      } else {
        await db.execute(`DELETE FROM auth WHERE key = ?`, ['current_user']);
      }
      set({ currentUser: user });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to set current user' });
      throw e;
    }
  },

  getToken: (campaignId: string): CampaignToken | null => {
    return get().tokens.get(campaignId) ?? null;
  },

  setToken: async (campaignId: string, token: CampaignToken) => {
    set({ error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      const now = new Date().toISOString();
      const key = `token_${campaignId}`;
      await db.execute(
        `INSERT OR REPLACE INTO auth (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, JSON.stringify(token), now]
      );
      set({ tokens: new Map(get().tokens).set(campaignId, token) });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to set token' });
      throw e;
    }
  },

  deleteToken: async (campaignId: string) => {
    set({ error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      const key = `token_${campaignId}`;
      await db.execute(`DELETE FROM auth WHERE key = ?`, [key]);
      const next = new Map(get().tokens);
      next.delete(campaignId);
      set({ tokens: next });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to delete token' });
      throw e;
    }
  },

  clearAll: async () => {
    set({ error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      await db.execute(`DELETE FROM auth`);
      set({ currentUser: null, tokens: new Map(), syncCredentials: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to clear auth data' });
      throw e;
    }
  },

  saveCredentials: async (credentials: SyncCredentials) => {
    set({ error: null });
    try {
      await ensureDatabaseReady();
      const db = getDB();
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO auth (key, value, updated_at) VALUES (?, ?, ?)`,
        ['sync_credentials', JSON.stringify(credentials), now]
      );
      set({ syncCredentials: credentials });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to save credentials' });
      throw e;
    }
  },

  getCredentials: (): SyncCredentials | null => {
    return get().syncCredentials;
  },

  testConnection: async (credentials?: SyncCredentials): Promise<boolean> => {
    const creds = credentials ?? get().syncCredentials;
    if (!creds?.serverUrl || !creds?.username) {
      return false;
    }
    try {
      const response = await fetch(`${creds.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${toBase64(`${creds.username}:${creds.password}`)}`,
        },
        signal: timeoutSignal(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
}));

// Initialize on import (fire-and-forget)
useAuthDB.getState().refresh();

// React hook wrapper for components that need reactive state
import { useSyncExternalStore } from 'react';

export function useAuthDBHook() {
  const state = useSyncExternalStore(
    useAuthDB.subscribe,
    () => useAuthDB.getState(),
    () => ({ ...useAuthDB.getState(), loading: true })
  );

  return {
    ...state,
    getToken: (campaignId: string) => useAuthDB.getState().getToken(campaignId),
    getCredentials: () => useAuthDB.getState().getCredentials(),
  };
}