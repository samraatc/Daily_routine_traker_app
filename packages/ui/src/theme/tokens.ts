// Neumorphic design tokens — single source of truth for the visual language.
// See docs/03-design-system.md.

export type ThemeName = 'light' | 'dark' | 'high-contrast';

export type Theme = {
  name: ThemeName;
  colors: {
    bg: { base: string; surface: string; surfacePressed: string };
    text: { primary: string; secondary: string; disabled: string };
    accent: { primary: string; success: string; warning: string; danger: string };
    border: { default: string; focus: string };
  };
  shadow: {
    outer: { lt: string; dk: string };
    inner: { lt: string; dk: string };
  };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  elevation: { rest: ElevationLevel; hover: ElevationLevel; pressed: ElevationLevel };
  spacing: number[]; // 0..8 ⇒ 0,4,8,12,16,24,32,48,64
  font: {
    display: TypeStyle;
    h1: TypeStyle;
    h2: TypeStyle;
    h3: TypeStyle;
    body: TypeStyle;
    bodyMedium: TypeStyle;
    caption: TypeStyle;
    mono: TypeStyle;
  };
  motion: {
    spring: {
      gentle: SpringConfig;
      default: SpringConfig;
      snappy: SpringConfig;
    };
    duration: { fast: number; normal: number; slow: number };
  };
};

export type ElevationLevel = {
  /** Y offset for the dark (bottom-right) shadow. */
  offset: number;
  /** Blur radius. */
  blur: number;
  /** Spring damping override for entering this elevation, if any. */
  damping?: number;
};

export type TypeStyle = {
  family: string;
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700';
};

export type SpringConfig = { damping: number; stiffness: number };

const spacing = [0, 4, 8, 12, 16, 24, 32, 48, 64];

const motion: Theme['motion'] = {
  spring: {
    gentle: { damping: 24, stiffness: 160 },
    default: { damping: 18, stiffness: 220 },
    snappy: { damping: 14, stiffness: 320 },
  },
  duration: { fast: 180, normal: 320, slow: 540 },
};

const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

const elevation: Theme['elevation'] = {
  rest: { offset: 6, blur: 18 },
  hover: { offset: 10, blur: 26 },
  pressed: { offset: 0, blur: 0 },
};

const fonts = (family = 'Inter'): Theme['font'] => ({
  display: { family, size: 32, lineHeight: 40, weight: '700' },
  h1: { family, size: 26, lineHeight: 34, weight: '700' },
  h2: { family, size: 22, lineHeight: 30, weight: '600' },
  h3: { family, size: 18, lineHeight: 26, weight: '600' },
  body: { family, size: 16, lineHeight: 24, weight: '400' },
  bodyMedium: { family, size: 16, lineHeight: 24, weight: '500' },
  caption: { family, size: 13, lineHeight: 18, weight: '500' },
  mono: { family: 'JetBrains Mono', size: 14, lineHeight: 22, weight: '400' },
});

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    bg: { base: '#E8ECF2', surface: '#EDF1F7', surfacePressed: '#E0E4EB' },
    text: { primary: '#1A1D24', secondary: '#5C6275', disabled: '#9BA1B0' },
    accent: { primary: '#6D28D9', success: '#16A34A', warning: '#D97706', danger: '#DC2626' },
    border: { default: 'transparent', focus: '#6D28D9' },
  },
  shadow: {
    outer: { lt: 'rgba(255,255,255,0.9)', dk: 'rgba(28,40,75,0.12)' },
    inner: { lt: 'rgba(255,255,255,0.7)', dk: 'rgba(28,40,75,0.18)' },
  },
  radius,
  elevation,
  spacing,
  font: fonts(),
  motion,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    bg: { base: '#1A1D24', surface: '#22262F', surfacePressed: '#1E2128' },
    text: { primary: '#E8ECF2', secondary: '#A0A6B8', disabled: '#6A6F7E' },
    accent: { primary: '#A78BFA', success: '#4ADE80', warning: '#FBBF24', danger: '#F87171' },
    border: { default: 'transparent', focus: '#A78BFA' },
  },
  shadow: {
    outer: { lt: 'rgba(255,255,255,0.04)', dk: 'rgba(0,0,0,0.55)' },
    inner: { lt: 'rgba(255,255,255,0.04)', dk: 'rgba(0,0,0,0.6)' },
  },
  radius,
  elevation,
  spacing,
  font: fonts(),
  motion,
};

export const highContrastTheme: Theme = {
  ...lightTheme,
  name: 'high-contrast',
  shadow: {
    outer: { lt: 'transparent', dk: 'transparent' },
    inner: { lt: 'transparent', dk: 'transparent' },
  },
  colors: {
    ...lightTheme.colors,
    border: { default: '#1A1D24', focus: '#6D28D9' },
  },
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  'high-contrast': highContrastTheme,
};

/** Token helpers (subset most components reach for). */
export const tokens = {
  space: (n: number) => spacing[n] ?? n * 4,
  radius,
  motion,
  elevation,
};
