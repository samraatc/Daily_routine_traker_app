import { create } from 'zustand';

import { readJson, remove, writeJson } from '@/lib/storage';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'contributor' | 'moderator' | 'admin' | 'super_admin';
  timezone: string;
  locale: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (s: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setUser: (u: AuthUser) => void;
  signOut: () => void;
};

const TOKEN_KEY = 'auth.tokens';
const USER_KEY = 'auth.user';

type PersistedTokens = { accessToken: string; refreshToken: string };

export const useAuthStore = create<AuthState>((set) => {
  // Synchronously hydrate from MMKV.
  const tokens = readJson<PersistedTokens>(TOKEN_KEY, true);
  const user = readJson<AuthUser>(USER_KEY);
  return {
    accessToken: tokens?.accessToken ?? null,
    refreshToken: tokens?.refreshToken ?? null,
    user,
    hydrated: true,
    setSession: ({ accessToken, refreshToken, user }) => {
      writeJson(TOKEN_KEY, { accessToken, refreshToken }, true);
      writeJson(USER_KEY, user);
      set({ accessToken, refreshToken, user });
    },
    setUser: (u) => {
      writeJson(USER_KEY, u);
      set({ user: u });
    },
    signOut: () => {
      remove(TOKEN_KEY, true);
      remove(USER_KEY);
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
});
