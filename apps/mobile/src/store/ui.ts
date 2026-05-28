import { type ThemeName } from '@app/ui';
import { create } from 'zustand';

import { readJson, writeJson } from '@/lib/storage';

type UIState = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const PERSIST_KEY = 'ui.theme';

export const useUIStore = create<UIState>((set) => ({
  theme: (readJson<ThemeName>(PERSIST_KEY) ?? 'light') as ThemeName,
  setTheme: (theme) => {
    writeJson(PERSIST_KEY, theme);
    set({ theme });
  },
}));
