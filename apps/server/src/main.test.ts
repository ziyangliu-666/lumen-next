import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// npm run verify typechecks/builds the server before tests. Use the actual entry
// point with an isolated environment: no developer credentials or DB connection.
function start(env: Record<string, string | undefined>): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../dist/main.js', import.meta.url))], {
    env: { NODE_ENV: 'production', LUMEN_LOG_LEVEL: 'fatal', ...env },
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 131072,
  });
}

it('refuses malformed or partial Keys configuration before database initialization or listen', () => {
  for (const env of [
    { BILLING_SECRET_KEYRING: 'synthetic-invalid-value', BILLING_SECRET_ACTIVE_KEY_ID: 'active' },
    { BILLING_SECRET_ACTIVE_KEY_ID: 'active' },
  ]) {
    const result = start(env);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('invalid billing secret configuration');
    expect(result.stdout).not.toContain('DATABASE_URL is required');
    expect(result.stdout + result.stderr).not.toContain('synthetic-invalid-value');
  }
});

it('accepts missing or valid Keys configuration without bypassing normal startup requirements', () => {
  const value = randomBytes(32).toString('base64');
  for (const env of [
    {},
    {
      BILLING_SECRET_KEYRING: JSON.stringify({ active: value }),
      BILLING_SECRET_ACTIVE_KEY_ID: 'active',
    },
  ]) {
    const result = start(env);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('DATABASE_URL is required in production');
    expect(result.stdout).not.toContain('invalid billing secret configuration');
    expect(result.stdout + result.stderr).not.toContain(value);
  }
});
