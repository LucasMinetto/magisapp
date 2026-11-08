import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; username: string; campaignId: string } | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, campaignUrl: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: { id: string; username: string; campaignId: string }, token: string) => void;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: true,

      login: async (username: string, password: string, campaignUrl: string) => {
        // TODO: Implement actual login API call
        set({
          isAuthenticated: true,
          user: { id: '1', username, campaignId: 'default' },
          token: 'mock-token',
          loading: false,
        });
      },

      logout: () => {
        set({ isAuthenticated: false, user: null, token: null });
      },

      setAuth: (user, token) => {
        set({ isAuthenticated: true, user, token, loading: false });
      },

      checkAuth: async () => {
        // TODO: Validate token with server
        set({ loading: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
);