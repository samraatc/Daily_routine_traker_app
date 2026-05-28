import axios, { type AxiosInstance } from 'axios';
import Constants from 'expo-constants';

import { useAuthStore } from '@/store/auth';

const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:4000/api/v1';

export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let refreshInFlight: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original?._retried) {
      original._retried = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().signOut();
        throw err;
      }
      refreshInFlight ??= (async () => {
        try {
          const res = await axios.post(
            `${baseURL}/auth/refresh`,
            { refreshToken },
            { timeout: 15_000 },
          );
          const { accessToken, refreshToken: nextRefresh } = res.data as {
            accessToken: string;
            refreshToken: string;
          };
          const user = useAuthStore.getState().user;
          if (user) {
            useAuthStore.getState().setSession({ accessToken, refreshToken: nextRefresh, user });
          }
          return accessToken;
        } catch {
          useAuthStore.getState().signOut();
          return null;
        } finally {
          refreshInFlight = null;
        }
      })();
      const newToken = await refreshInFlight;
      if (!newToken) throw err;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api.request(original);
    }
    throw err;
  },
);
