import base from './base.js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,js,mts,cts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
