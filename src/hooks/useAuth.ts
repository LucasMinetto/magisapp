/**
 * Hook de autenticação real: login com usuário/senha, JWT, refresh tokens,
 * armazenamento seguro e QR code/Deep Link para configuração rápida.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, ensureDatabaseReady } from '../db';
import { useAuthDB, type SyncCredentials, type CurrentUser, type CampaignToken } from './useAuthDB';
import { parseDeepLinkUrl, type QRCodePayload } from './useQRCode';

interface AuthState {
  isAuthenticated: boolean;
  user: CurrentUser | null;
  token: string | null;
  campaignId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string, serverUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (user: CurrentUser, token: string, campaignId: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  setCampaign: (campaignId: string) => Promise<void>;
  handleDeepLink: (url: string) => Promise<void>;
  clearError: () => void;
}

// Chaves para AsyncStorage
const AUTH_STORAGE_KEY = 'magistrado-auth';

function isTokenExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

async function performLogin(username: string, password: string, serverUrl: string): Promise<{ user: CurrentUser; token: string; campaignId: string }> {
  await ensureDatabaseReady();

  const response = await fetch(`${serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Credenciais inválidas' }));
    throw new Error(errorData.message || `Erro ${response.status}`);
  }

  const data = await response.json();
  // Espera: { user: { id, username, email?, avatarUrl? }, token: string, campaignId: string, expiresIn?: number }
  if (!data.user || !data.token || !data.campaignId) {
    throw new Error('Resposta de login inválida do servidor');
  }

  return {
    user: data.user,
    token: data.token,
    campaignId: data.campaignId,
  };
}

async function refreshAccessToken(serverUrl: string, refreshToken: string): Promise<string> {
  const response = await fetch(`${serverUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error('Token expirado, faça login novamente');
  }

  const data = await response.json();
  if (!data.token) throw new Error('Resposta de refresh inválida');
  return data.token;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      campaignId: null,
      loading: true,
      error: null,

      login: async (username: string, password: string, serverUrl: string) => {
        set({ loading: true, error: null });
        try {
          const { user, token, campaignId } = await performLogin(username, password, serverUrl);

          // Salvar credenciais de sync no AuthDB
          await useAuthDB.getState().saveCredentials({ serverUrl, username, password });

          // Salvar token da campanha
          await useAuthDB.getState().setToken(campaignId, {
            campaignId,
            accessToken: token,
            refreshToken: undefined,
            expiresAt: undefined,
          });

          set({
            isAuthenticated: true,
            user,
            token,
            campaignId,
            loading: false,
            error: null,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Falha no login';
          set({ loading: false, error: message, isAuthenticated: false, user: null, token: null, campaignId: null });
          throw e;
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
          await useAuthDB.getState().clearAll();
        } catch {
          // Ignora erros de limpeza
        }
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          campaignId: null,
          loading: false,
          error: null,
        });
      },

      setAuth: async (user: CurrentUser, token: string, campaignId: string) => {
        await useAuthDB.getState().setToken(campaignId, { campaignId, accessToken: token });
        set({ isAuthenticated: true, user, token, campaignId, loading: false });
      },

      checkAuth: async () => {
        set({ loading: true, error: null });
        try {
          await ensureDatabaseReady();

          const authDB = useAuthDB.getState();
          const { currentUser, tokens, syncCredentials } = authDB;

          if (!currentUser || !syncCredentials) {
            set({ loading: false, isAuthenticated: false });
            return;
          }

          // Verifica se temos token para alguma campanha
          const campaignIds = Array.from(tokens.keys());
          const campaignId = campaignIds[0] ?? null;
          const campaignToken = campaignId ? tokens.get(campaignId) : null;

          if (campaignToken?.accessToken) {
            // Verifica expiração
            if (isTokenExpired(campaignToken.expiresAt)) {
              // Tenta refresh se tiver refreshToken
              if (campaignToken.refreshToken) {
                try {
                  const newToken = await refreshAccessToken(syncCredentials.serverUrl, campaignToken.refreshToken);
                  await authDB.setToken(campaignId!, { ...campaignToken, accessToken: newToken });
                  set({ isAuthenticated: true, user: currentUser, token: newToken, campaignId, loading: false });
                  return;
                } catch {
                  // Refresh falhou, precisa logar de novo
                }
              }
            } else {
              set({ isAuthenticated: true, user: currentUser, token: campaignToken.accessToken, campaignId, loading: false });
              return;
            }
          }

          set({ loading: false, isAuthenticated: false });
        } catch (e) {
          console.warn('[auth] checkAuth error:', e);
          set({ loading: false, isAuthenticated: false, error: 'Erro ao verificar autenticação' });
        }
      },

      setCampaign: async (campaignId: string) => {
        const { tokens } = useAuthDB.getState();
        const campaignToken = tokens.get(campaignId);
        if (campaignToken?.accessToken) {
          const { currentUser } = useAuthDB.getState();
          set({ campaignId, token: campaignToken.accessToken, user: currentUser });
        }
      },

      handleDeepLink: async (url: string) => {
        set({ loading: true, error: null });
        try {
          const result = parseDeepLinkUrl(url);
          if (!result.success || !result.payload) {
            throw new Error(result.error || 'Deep link inválido');
          }

          const payload = result.payload as QRCodePayload;
          const credentials: SyncCredentials = {
            serverUrl: payload.serverUrl,
            username: payload.username,
            password: payload.password,
          };

          await useAuthDB.getState().saveCredentials(credentials);

          // Testa conexão e tenta login automático
          const connected = await useAuthDB.getState().testConnection(credentials);
          if (connected) {
            try {
              await get().login(payload.username, payload.password, payload.serverUrl);
              // Define a campanha do QR code
              await get().setCampaign(payload.campaignId);
            } catch {
              // Login falhou, mas credenciais foram salvas
              set({ error: 'Credenciais salvas, mas login falhou. Tente sincronizar.' });
            }
          } else {
            set({ error: 'Credenciais salvas, mas servidor inacessível' });
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Erro ao processar QR code';
          set({ loading: false, error: message });
          throw e;
        } finally {
          if (get().loading) set({ loading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        campaignId: state.campaignId,
      }),
      // Migração de versões antigas
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const old = persistedState as Record<string, unknown>;
          return {
            isAuthenticated: Boolean(old.isAuthenticated),
            user: old.user as CurrentUser | null,
            token: old.token as string | null,
            campaignId: old.campaignId as string | null,
            loading: true,
            error: null,
          };
        }
        return persistedState as AuthState;
      },
    }
  )
);

// Selectors para uso fácil em componentes
export const useAuthUser = () => useAuth((s) => s.user);
export const useAuthToken = () => useAuth((s) => s.token);
export const useAuthCampaign = () => useAuth((s) => s.campaignId);
export const useAuthLoading = () => useAuth((s) => s.loading);
export const useAuthError = () => useAuth((s) => s.error);
export const useIsAuthenticated = () => useAuth((s) => s.isAuthenticated);