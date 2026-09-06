import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'packages/contracts/src/**',
        'apps/server/src/core/**',
        'apps/server/src/modules/**',
      ],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: { lines: 60 },
      reporter: ['text-summary'],
    },
  },
});
