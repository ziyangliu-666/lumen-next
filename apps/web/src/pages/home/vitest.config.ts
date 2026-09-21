import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/web/src/pages/home/**/*.test.ts'] } });
