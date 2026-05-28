import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { base: '#E8ECF2', surface: '#EDF1F7', surfacePressed: '#E0E4EB' },
        accent: { primary: '#6D28D9', success: '#16A34A', danger: '#DC2626' },
      },
      borderRadius: {
        neu: '22px',
      },
    },
  },
  plugins: [],
};

export default config;
