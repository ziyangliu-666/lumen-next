import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The web app's own alias, so that a test can import a page's parts.
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
  test: {
    // The web app's tests need no DOM: plain functions (a retry schedule, a
    // reducer), and components rendered to a string with react-dom/server. So
    // they run here with the rest and are part of the gate. A test that needs
    // clicks gets a DOM environment when the first one lands.
    include: [
      'packages/**/*.test.ts',
      'apps/server/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/contracts/src/**',
        'apps/server/src/core/**',
        'apps/server/src/modules/**',
      ],
      exclude: ['**/*.test.ts', '**/index.ts'],
      // The coverage gate.
      thresholds: { lines: 70 },
      reporter: ['text-summary'],
    },
  },
});
