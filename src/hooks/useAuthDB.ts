import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../db';

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

export interface UseAuthDBResult {
  currentUser: CurrentUser | null;
  tokens: Map<string, CampaignToken>;
  loading: boolean;
  error: string | null;
  setCurrentUser: (user: CurrentUser | null) => Promise<void>;
  getToken: (campaignId: string) => CampaignToken | null;
  setToken: (campaignId: string, token: CampaignToken) => Promise<void>;
  deleteToken: (campaignId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
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

export function useAuthDB(): UseAuthDBResult {
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
  const [tokens, setTokensState] = useState<Map<string, CampaignToken>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = getDB();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await db.execute(`SELECT * FROM auth`);
      const newTokens = new Map<string, CampaignToken>();
      let user: CurrentUser | null = null;

      for (const row of result.rows) {
        const r = row as unknown as AuthRow;
        if (r.key === 'current_user') {
          user = parseCurrentUser(r.value);
        } else if (r.key.startsWith('token_')) {
          const campaignId = r.key.slice(6); // remove 'token_' prefix
          const token = parseToken(r.value);
          if (token) {
            newTokens.set(campaignId, token);
          }
        }
      }

      setCurrentUserState(user);
      setTokensState(newTokens);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load auth data');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentUser = useCallback(async (user: CurrentUser | null) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      if (user) {
        const value = JSON.stringify(user).replace(/'/g, "''");
        await db.execute(`INSERT OR REPLACE INTO auth (key, value, updated_at) VALUES ('current_user', '${value}', '${now}')`);
      } else {
        await db.execute(`DELETE FROM auth WHERE key = 'current_user'`);
      }
      setCurrentUserState(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set current user');
      throw e;
    }
  }, [db]);

  const getToken = useCallback((campaignId: string): CampaignToken | null => {
    return tokens.get(campaignId) ?? null;
  }, [tokens]);

  const setToken = useCallback(async (campaignId: string, token: CampaignToken) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const key = `token_${campaignId}`;
      const value = JSON.stringify(token).replace(/'/g, "''");
      await db.execute(`INSERT OR REPLACE INTO auth (key, value, updated_at) VALUES ('${key}', '${value}', '${now}')`);
      setTokensState(prev => new Map(prev).set(campaignId, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set token');
      throw e;
    }
  }, [db]);

  const deleteToken = useCallback(async (campaignId: string) => {
    setError(null);
    try {
      const key = `token_${campaignId}`;
      await db.execute(`DELETE FROM auth WHERE key = '${key}'`);
      setTokensState(prev => {
        const next = new Map(prev);
        next.delete(campaignId);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete token');
      throw e;
    }
  }, [db]);

  const clearAll = useCallback(async () => {
    setError(null);
    try {
      await db.execute(`DELETE FROM auth`);
      setCurrentUserState(null);
      setTokensState(new Map());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear auth data');
      throw e;
    }
  }, [db]);

  return {
    currentUser,
    tokens,
    loading,
    error,
    setCurrentUser,
    getToken,
    setToken,
    deleteToken,
    clearAll,
    refresh,
  };
}