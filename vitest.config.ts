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
      // The gate rises each sprint (docs/CODING_STANDARDS.md): 60, 65, 70, 70.
      thresholds: { lines: 65 },
      reporter: ['text-summary'],
    },
  },
});
