import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 15_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
