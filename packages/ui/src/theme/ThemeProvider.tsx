import React, { createContext, useContext, useMemo } from 'react';

import { themes, type Theme, type ThemeName } from './tokens.js';

const ThemeContext = createContext<Theme>(themes.light);

export type ThemeProviderProps = {
  name?: ThemeName;
  children: React.ReactNode;
};

export function ThemeProvider({ name = 'light', children }: ThemeProviderProps) {
  const theme = useMemo<Theme>(() => themes[name], [name]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
