// The server's imports name the compiled .js files, which Node's built-in type
// stripping cannot map back to .ts. So development runs what production runs:
// tsc keeps dist/ current, and node --watch restarts the server when it changes.
// The repository's .env is loaded when it exists. Node rather than a shell
// pipeline, because part of the team develops on Windows.
const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const envFile = join(root, '..', '..', '.env');
const tsc = require.resolve('typescript/bin/tsc');
const copyMigrations = join(__dirname, 'copy-migrations.cjs');

let server;

const build = spawn(process.execPath, [tsc, '--build', '--watch', '--preserveWatchOutput'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});

build.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!String(chunk).includes('Found 0 errors.')) return;
  spawnSync(process.execPath, [copyMigrations], { stdio: 'inherit' });
  server ??= spawn(
    process.execPath,
    ['--watch', ...(existsSync(envFile) ? [`--env-file=${envFile}`] : []), 'dist/main.js'],
    { cwd: root, stdio: 'inherit' },
  );
});

build.on('exit', (code) => {
  server?.kill();
  process.exit(code ?? 0);
});
