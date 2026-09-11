import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The contract from its source, so the web app typechecks and builds on a
      // fresh clone without building packages/contracts first. tsconfig.json
      // carries the same mapping for tsc and ESLint.
      '@lumen/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
  // In development the API and the event stream come from the server process
  // on 4000, so the page sees one origin and no CORS, the same as in production.
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/ws': { target: 'ws://localhost:4000', ws: true },
    },
  },
});
