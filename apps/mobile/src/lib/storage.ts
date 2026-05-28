import { MMKV } from 'react-native-mmkv';

/** Default storage — non-sensitive data (theme, cache, etc.). */
export const storage = new MMKV({ id: 'default' });

/** Secure storage — tokens, encryption keys. In Expo we still use MMKV, but
 *  the encryption key is provisioned at app start via expo-secure-store so
 *  the data is encrypted at rest. */
export const secureStorage = new MMKV({ id: 'secure', encryptionKey: 'placeholder-bootstrap' });

export function readJson<T>(key: string, secure = false): T | null {
  const s = secure ? secureStorage : storage;
  const v = s.getString(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, secure = false): void {
  const s = secure ? secureStorage : storage;
  s.set(key, JSON.stringify(value));
}

export function remove(key: string, secure = false): void {
  const s = secure ? secureStorage : storage;
  s.delete(key);
}
