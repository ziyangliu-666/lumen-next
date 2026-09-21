import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The web app's tests are plain functions for now (a retry schedule, a
    // reducer): no DOM, so they run here with the rest and are part of the gate.
    // A test that needs a DOM gets its own environment when the first one lands.
    include: ['packages/**/*.test.ts', 'apps/server/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
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
