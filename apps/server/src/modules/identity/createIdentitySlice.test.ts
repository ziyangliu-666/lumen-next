import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { AUTH_COOKIE } from './sessionStrategy.js';
import { hashPassword } from './passwordHash.js';

const origin = 'https://lumen.example';
const password = 'a long test passphrase';
const principal = { accountId: 'account-id', role: 'user' as const };
const account = {
  id: principal.accountId,
  role: principal.role,
  email: 'user@example.edu',
  displayName: 'User',
  createdAt: 1000,
};
const servers: FastifyInstance[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

// Queued SQL replies verify factory wiring, not PostgreSQL behavior.
function database(results: (object[] | Error)[]): IdentityDatabase & {
  calls: [string, readonly unknown[]][];
} {
  const calls: [string, readonly unknown[]][] = [];
  const query: IdentitySql['query'] = <Row extends object>(
    text: string,
    values: readonly unknown[],
  ): Promise<Row[]> => {
    calls.push([text, values]);
    const result = results.shift();
    if (result instanceof Error) return Promise.reject(result);
    if (!result) return Promise.reject(new Error('Unexpected query'));
    return Promise.resolve(result as Row[]);
  };
  return { query, calls, withTransaction: (work) => work({ query }) };
}

async function setup(db: IdentityDatabase): Promise<FastifyInstance> {
  const identity = createIdentitySlice({
    database: db,
    origin,
    sessionLifetimeMs: 60_000,
    loginGate: new LoginGate(),
  });
  const app = await buildServer({
    broker: new Broker(),
    resolver: identity.principalResolver,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  servers.push(app);
  await app.register(identity.registerRoutes);
  return app;
}

describe('identity: SQL-backed slice composition', () => {
  it('rejects stub headers and absent cookies without asking the database', async () => {
    const db = database([]);
    const app = await setup(db);
    const response = await app.inject({
      url: '/api/me',
      headers: { authorization: 'stub account-id:staff' },
    });
    expect(response.statusCode).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it('wires signup through SQL stores and puts only the session token in the cookie', async () => {
    const db = database([[account], [], []]);
    const app = await setup(db);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email: account.email, displayName: account.displayName, password },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(principal);
    expect(response.cookies[0]).toMatchObject({ name: AUTH_COOKIE, httpOnly: true, secure: true });
    expect(db.calls[1]?.[1]?.[1]).toMatch(/^scrypt\$v1\$/);
    expect(db.calls[2]?.[1]?.[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(db.calls)).not.toContain(password);
  });

  it('wires password strategy through the durable session completion hook', async () => {
    const passwordHash = await hashPassword(password);
    const db = database([[{ ...principal, passwordHash, suspended: false }], []]);
    const response = await (
      await setup(db)
    ).inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: account.email, password },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(principal);
    expect(db.calls[1]?.[0]).toContain('insert into auth_sessions');
  });

  it('reads current session identity and the account without issuing a new session', async () => {
    const db = database([
      [{ ...principal, suspended: false, expiresAt: Date.now() + 60_000 }],
      [account],
    ]);
    const response = await (
      await setup(db)
    ).inject({
      url: '/api/me',
      cookies: { [AUTH_COOKIE]: Buffer.alloc(32, 1).toString('base64url') },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(account);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(db.calls.every(([sql]) => sql.trim().startsWith('select'))).toBe(true);
  });

  it('clears and durably revokes a cookie even when its record is already missing', async () => {
    const db = database([[], []]);
    const response = await (
      await setup(db)
    ).inject({
      method: 'POST',
      url: '/api/auth/signout',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: Buffer.alloc(32, 1).toString('base64url') },
    });
    expect(response.statusCode).toBe(204);
    expect(response.cookies[0]?.value).toBe('');
    expect(db.calls[1]?.[0]).toContain('delete from auth_sessions');
  });

  it('fails closed on database outages without leaking details', async () => {
    const db = database([new Error('private connection details')]);
    const response = await (
      await setup(db)
    ).inject({
      url: '/api/me',
      cookies: { [AUTH_COOKIE]: Buffer.alloc(32, 1).toString('base64url') },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'internal error' });
    expect(response.cookies).toHaveLength(0);
  });

  it('validates explicit lifetime and trusted origin before any database work', () => {
    const db = database([]);
    const options = { database: db, origin, sessionLifetimeMs: 60_000, loginGate: new LoginGate() };
    expect(() => createIdentitySlice({ ...options, sessionLifetimeMs: 0 })).toThrow(
      'Invalid session lifetime',
    );
    expect(() => createIdentitySlice({ ...options, origin: 'http://example.com' })).toThrow(
      'Secure cookies require HTTPS',
    );
    expect(() =>
      createIdentitySlice({ ...options, origin: 'http://localhost:4173', secureCookies: false }),
    ).not.toThrow();
    expect(db.calls).toHaveLength(0);
  });
});
