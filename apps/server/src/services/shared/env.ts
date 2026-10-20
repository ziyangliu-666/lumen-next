// What every service reads from its environment. The rules are main.ts's: the
// monolith and the services must accept the same variables with the same
// meaning, so one ConfigMap and one Secret serve both. main.ts keeps its own
// copy because it bootstraps on import and so cannot be imported.
import { join } from 'node:path';
import type { IdentityConfig } from '../../app.js';
import { openDatabase, type Db } from '../../core/db/db.js';
import { createLog, type Log } from '../../core/log/log.js';
import {
  mailFromEnvironment,
  oauthProvidersFromEnvironment,
} from '../../modules/identity/index.js';

type Env = Record<string, string | undefined>;

export function serviceLog(service: string, env: Env = process.env): Log {
  return createLog({
    level: env['LUMEN_LOG_LEVEL'] ?? 'info',
    pretty: process.stdout.isTTY === true && env['NODE_ENV'] !== 'production',
  }).child({ service });
}

/** A variable the service cannot run without. The error names it. */
export function required(name: string, env: Env = process.env): string {
  const value = env[name];
  if (value === undefined || value === '') throw new Error(`${name} is required`);
  return value;
}

export function port(env: Env = process.env): number {
  const raw = env['LUMEN_PORT'];
  if (raw === undefined || raw === '') return 4000;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`LUMEN_PORT must be a port number, got "${raw}"`);
  }
  return parsed;
}

/**
 * Every service shares one database (docs/platform/contract.md, "Data").
 * node-pg-migrate takes an advisory lock and waits for it, so several pods
 * that start together migrate one after another, never at once.
 */
export function database(log: Log, env: Env = process.env): Promise<Db> {
  return openDatabase(required('DATABASE_URL', env), { log });
}

/** The same identity configuration as main.ts's identityConfig(). */
export function identityConfig(env: Env = process.env): IdentityConfig {
  const origin = required('LUMEN_ORIGIN', env);
  const lifetime = Number(env['IDENTITY_SESSION_LIFETIME_MS']);
  if (!Number.isSafeInteger(lifetime) || lifetime <= 0) {
    throw new Error('IDENTITY_SESSION_LIFETIME_MS must be a positive integer');
  }
  const insecure = env['IDENTITY_INSECURE_COOKIES'];
  if (insecure !== undefined && insecure !== 'true' && insecure !== 'false') {
    throw new Error('IDENTITY_INSECURE_COOKIES must be true or false');
  }
  const mail = mailFromEnvironment(env, {
    outboxDirectory: join(process.cwd(), '.data', 'identity-mail-outbox'),
    production: env['NODE_ENV'] === 'production',
    origin,
  });
  return {
    origin,
    sessionLifetimeMs: lifetime,
    ...(mail ? { mail } : {}),
    oauthProviders: oauthProvidersFromEnvironment(env, origin, {
      allowLoopbackHttp: env['NODE_ENV'] !== 'production' && insecure === 'true',
    }),
    ...(insecure === undefined ? {} : { secureCookies: insecure !== 'true' }),
  };
}

/** Behind HTTPS, send Strict-Transport-Security, as main.ts does. */
export function strictTransport(env: Env = process.env): boolean {
  return env['LUMEN_ORIGIN']?.startsWith('https://') === true;
}

/** The shared key for /internal/* routes and calls. */
export function internalKey(env: Env = process.env): string {
  const key = required('LUMEN_INTERNAL_KEY', env);
  if (key.length < 32) throw new Error('LUMEN_INTERNAL_KEY must be at least 32 characters');
  return key;
}

/** Where the session service answers inside the cluster. */
export function sessionUrl(env: Env = process.env): string {
  return env['LUMEN_SESSION_URL'] ?? 'http://session:4000';
}
