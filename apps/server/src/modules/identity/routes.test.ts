import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AuthSessions, type StoredAuthSession } from './authSessions.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { SessionAuthFlow } from './sessionAuthFlow.js';
import { AUTH_COOKIE, SessionPrincipalResolver, SessionStrategy } from './sessionStrategy.js';
import { LoginGate } from './loginGate.js';
import { identityRoutes, type AccountView } from './routes.js';

const origin = 'https://lumen.example';
const account: AccountView = {
  id: 'account-1',
  email: 'a@example.edu',
  displayName: 'A',
  role: 'user',
  createdAt: 1000,
};
const principal = { accountId: account.id, role: account.role };
const servers: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of servers.splice(0)) await app.close();
});

interface Fixture {
  app: FastifyInstance;
  sessions: AuthSessions;
  getAccount: Mock<(id: string) => Promise<AccountView | null>>;
}

async function setup(
  options: { origin?: string; secureCookies?: boolean; attempts?: number } = {},
): Promise<Fixture> {
  const records = new Map<string, StoredAuthSession>();
  const sessions = new AuthSessions(
    {
      insert: (row) => {
        records.set(row.tokenHash, { principal, suspended: false, expiresAt: row.expiresAt });
        return Promise.resolve();
      },
      findByTokenHash: (hash) => Promise.resolve(records.get(hash) ?? null),
      deleteByTokenHash: (hash) => {
        records.delete(hash);
        return Promise.resolve();
      },
      deleteByAccountId: (id) => {
        for (const [hash, row] of records) if (row.principal.accountId === id) records.delete(hash);
        return Promise.resolve();
      },
    },
    { lifetimeMs: 60_000 },
  );
  const password = new PasswordStrategy(
    {
      findByEmail: (email) =>
        Promise.resolve(
          email === account.email
            ? { principal, suspended: false, passwordHash: 'test-hash' }
            : null,
        ),
    },
    (secret) => Promise.resolve(secret === 'correct password'),
  );
  const getAccount = vi
    .fn<(id: string) => Promise<AccountView | null>>()
    .mockResolvedValue(account);
  const app = await buildServer({
    broker: new Broker(),
    resolver: new SessionPrincipalResolver(new SessionStrategy(sessions)),
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  servers.push(app);
  await app.register(
    identityRoutes({
      flow: new SessionAuthFlow([password], sessions),
      sessions,
      accounts: { getAccount },
      management: {
        signup: () => Promise.resolve(account),
        update: () => Promise.resolve(account),
        changePassword: () => Promise.resolve(),
        deleteAccount: () => Promise.resolve(),
      },
      origin: options.origin ?? origin,
      secureCookies: options.secureCookies ?? true,
      loginGate: new LoginGate({ attempts: options.attempts ?? 100 }),
    }),
  );
  return { app, sessions, getAccount };
}

describe('identity: HTTP routes', () => {
  it('logs in with a host-only secure cookie and no bearer token in JSON', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: account.email, password: 'correct password' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toEqual(principal);
    expect(response.headers['cache-control']).toBe('no-store');
    const cookie = response.headers['set-cookie'];
    expect(cookie).toContain(`${AUTH_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Expires=');
    expect(cookie).not.toContain('Domain=');
    const token = response.cookies[0]!.value;
    const me = await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } });
    expect(me.statusCode).toBe(200);
    expect(me.json<unknown>()).toEqual(account);
    expect(me.headers['cache-control']).toBe('no-store');
  });

  it('limits normalized email failures across different direct peers', async () => {
    const { app } = await setup({ attempts: 1 });
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      remoteAddress: '192.0.2.1',
      payload: { email: account.email, password: 'wrong' },
    });
    expect(first.statusCode).toBe(401);
    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      remoteAddress: '192.0.2.2',
      payload: { email: ` ${account.email.toUpperCase()} `, password: 'wrong' },
    });
    expect(second.statusCode).toBe(429);
  });

  it('does not distinguish missing accounts from incorrect passwords', async () => {
    const { app } = await setup();
    const responses = [];
    for (const email of [account.email, 'missing@example.edu']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email, password: 'wrong' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.headers['set-cookie']).toBeUndefined();
      responses.push(response.json<unknown>());
    }
    expect(responses[0]).toEqual(responses[1]);
  });

  it.each([undefined, 'null', 'https://attacker.example', `${origin}/path`])(
    'rejects mutations with untrusted Origin: %s',
    async (suppliedOrigin) => {
      const { app } = await setup();
      for (const url of ['/api/auth/password', '/api/auth/signout', '/api/auth/signout-all']) {
        const response = await app.inject({
          method: 'POST',
          url,
          headers: suppliedOrigin === undefined ? {} : { origin: suppliedOrigin },
          payload: { email: account.email, password: 'correct password' },
        });
        expect(response.statusCode).toBe(403);
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('no-store');
      }
    },
  );

  it('rejects invalid login input before authenticating', async () => {
    const { app } = await setup();
    for (const payload of [
      {},
      { email: 42, password: [] },
      { email: 42, password: 'correct password' },
      { email: account.email, password: 12345678 },
      [],
      { email: account.email, password: '' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('does not expose storage details or issue cookies after session persistence fails', async () => {
    const { app, sessions } = await setup();
    vi.spyOn(sessions, 'issue').mockRejectedValueOnce(new Error('private write detail'));
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: account.email, password: 'correct password' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json<unknown>()).toEqual({ error: 'internal error' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('does not report successful signout when revocation fails', async () => {
    const { app, sessions } = await setup();
    vi.spyOn(sessions, 'revoke').mockRejectedValueOnce(new Error('private write detail'));
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signout',
      headers: { origin },
    });
    expect(response.statusCode).toBe(500);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('prevents caching even if the earlier core resolver fails', async () => {
    const { app, sessions } = await setup();
    vi.spyOn(sessions, 'verify').mockRejectedValueOnce(new Error('lookup failed'));
    const response = await app.inject('/api/me');
    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('projects only public account fields even if storage returns extra secrets', async () => {
    const { app, sessions, getAccount } = await setup();
    const stored = { ...account, passwordHash: 'must not leak', tokenHash: 'must not leak' };
    getAccount.mockResolvedValueOnce(stored);
    const { token } = await sessions.issue(principal);
    const response = await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } });
    expect(response.json<unknown>()).toEqual(account);
  });

  it('limits attempts even when X-Forwarded-For changes', async () => {
    const { app } = await setup({ attempts: 1 });
    for (const [index, address] of ['1.2.3.4', '5.6.7.8'].entries()) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin, 'x-forwarded-for': address },
        payload: { email: account.email, password: 'wrong' },
      });
      expect(response.statusCode).toBe(index === 0 ? 401 : 429);
    }
  });

  it('revokes one cookie session and clears its cookie', async () => {
    const { app, sessions } = await setup();
    const first = await sessions.issue(principal);
    const second = await sessions.issue(principal);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signout',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: first.token },
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['set-cookie']).toContain(`${AUTH_COOKIE}=;`);
    await expect(sessions.verify(first.token)).resolves.toBeNull();
    await expect(sessions.verify(second.token)).resolves.toEqual(principal);
    const repeated = await app.inject({
      method: 'POST',
      url: '/api/auth/signout',
      headers: { origin },
    });
    expect(repeated.statusCode).toBe(204);
  });

  it('revokes all login sessions for the authenticated account', async () => {
    const { app, sessions } = await setup();
    const first = await sessions.issue(principal);
    const second = await sessions.issue(principal);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signout-all',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: first.token },
    });
    expect(response.statusCode).toBe(204);
    await expect(sessions.verify(first.token)).resolves.toBeNull();
    await expect(sessions.verify(second.token)).resolves.toBeNull();
  });

  it('requires authentication for me and signout-all', async () => {
    const { app } = await setup();
    expect((await app.inject('/api/me')).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/api/auth/signout-all', headers: { origin } }))
        .statusCode,
    ).toBe(401);
  });

  it('rejects a deleted account and hides account-store failures', async () => {
    const { app, sessions, getAccount } = await setup();
    const { token } = await sessions.issue(principal);
    getAccount.mockResolvedValueOnce(null);
    expect(
      (await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } })).statusCode,
    ).toBe(401);
    getAccount.mockRejectedValueOnce(new Error('private database detail'));
    const failed = await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } });
    expect(failed.statusCode).toBe(500);
    expect(failed.json<unknown>()).toEqual({ error: 'internal error' });
  });

  it('allows insecure cookies only for explicitly configured loopback development', async () => {
    const { app } = await setup({ origin: 'http://localhost:4173', secureCookies: false });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin: 'http://localhost:4173' },
      payload: { email: account.email, password: 'correct password' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).not.toContain('Secure');
    await expect(setup({ secureCookies: false })).rejects.toThrow('Insecure cookies require');
    await expect(setup({ origin: 'https://lumen.example/path' })).rejects.toThrow(
      'Expected a canonical',
    );
  });
});
