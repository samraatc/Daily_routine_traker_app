import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthUser = {
  id: string;
  email: string;
  role: 'user' | 'contributor' | 'moderator' | 'admin' | 'super_admin';
  name: string | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (s: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (s) => set(s),
      signOut: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'admin-auth' },
  ),
);
