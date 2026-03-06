import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (updates) =>
        set((s) => ({ user: s.user ? { ...s.user, ...updates } : s.user })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => {
        const currentToken = useAuthStore.getState().token;
        try {
          const { disconnectSocket } = require('../services/socket') as {
            disconnectSocket?: () => void;
          };
          disconnectSocket?.();
        } catch {}
        try {
          const { unregisterPushTokenWithBackend } = require('../services/pushNotifications') as {
            unregisterPushTokenWithBackend?: (authToken?: string | null) => Promise<void>;
          };
          void unregisterPushTokenWithBackend?.(currentToken);
        } catch {}
        try {
          const { signOutFirebase } = require('../services/firebaseAuth') as {
            signOutFirebase?: () => Promise<void>;
          };
          void signOutFirebase?.();
        } catch {}
        set({ token: null, user: null });
      },
    }),
    {
      name: 'allconnect-auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
