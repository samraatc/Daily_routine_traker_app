import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/store/auth';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function useSignIn() {
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const res = await api.post<AuthResponse>('/auth/login', vars);
      return res.data;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (vars: {
      email: string;
      password: string;
      name?: string;
      timezone?: string;
    }) => {
      const res = await api.post<AuthResponse>('/auth/register', vars);
      return res.data;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data);
    },
  });
}
