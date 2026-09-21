import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AccountFailure, type AccountStore, type AccountView } from './accounts.js';
import { AccountService } from './accountService.js';
import { AuthSessions, type NewAuthSession } from './authSessions.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { SessionAuthFlow } from './sessionAuthFlow.js';
import { AUTH_COOKIE, SessionPrincipalResolver, SessionStrategy } from './sessionStrategy.js';
import { LoginGate } from './loginGate.js';
import { identityRoutes } from './routes.js';

const origin = 'https://lumen.example';
const password = 'a long test passphrase';
const servers: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of servers.splice(0)) await app.close();
});

// Test-only storage and cheap codec: exercise routing and service wiring, not SQL.
async function setup(): Promise<FastifyInstance> {
  const accounts = new Map<string, AccountView>();
  const passwords = new Map<string, string>();
  const tokens = new Map<string, NewAuthSession>();
  function unique(email: string, except?: string): void {
    if ([...accounts.values()].some((a) => a.email === email && a.id !== except)) {
      throw new AccountFailure('email_taken', 'Email is already registered');
    }
  }
  const store: AccountStore = {
    getAccount: (id) => Promise.resolve(accounts.get(id) ?? null),
    createPasswordAccount: (input) => {
      unique(input.email);
      const account: AccountView = {
        id: `account-${accounts.size + 1}`,
        email: input.email,
        displayName: input.displayName,
        role: 'user',
        createdAt: Date.now(),
      };
      accounts.set(account.id, account);
      passwords.set(account.id, input.passwordHash);
      return Promise.resolve(account);
    },
    getPasswordAccount: (id) => {
      const account = accounts.get(id);
      return Promise.resolve(
        account
          ? {
              principal: { accountId: id, role: account.role },
              passwordHash: passwords.get(id) ?? null,
              suspended: false,
            }
          : null,
      );
    },
    updateAccount: ({ accountId, patch, expectedPasswordHash }) => {
      const account = accounts.get(accountId);
      if (
        !account ||
        (expectedPasswordHash !== undefined && passwords.get(accountId) !== expectedPasswordHash)
      )
        return Promise.resolve(null);
      if (patch.email !== undefined) unique(patch.email, accountId);
      const updated = { ...account, ...patch };
      accounts.set(accountId, updated);
      return Promise.resolve(updated);
    },
    replacePassword: (id, expected, hash) => {
      if (passwords.get(id) !== expected) return Promise.resolve(false);
      passwords.set(id, hash);
      return Promise.resolve(true);
    },
  };
  const sessions = new AuthSessions(
    {
      insert: (row) => {
        tokens.set(row.tokenHash, row);
        return Promise.resolve();
      },
      findByTokenHash: (hash) => {
        const token = tokens.get(hash);
        const account = token && accounts.get(token.accountId);
        return Promise.resolve(
          token && account
            ? {
                principal: { accountId: account.id, role: account.role },
                suspended: false,
                expiresAt: token.expiresAt,
              }
            : null,
        );
      },
      deleteByTokenHash: (hash) => {
        tokens.delete(hash);
        return Promise.resolve();
      },
      deleteByAccountId: (id) => {
        for (const [key, row] of tokens) if (row.accountId === id) tokens.delete(key);
        return Promise.resolve();
      },
    },
    { lifetimeMs: 60_000 },
  );
  const codec = {
    hash: (text: string) => Promise.resolve(`hash:${text}`),
    verify: (text: string, hash: string) => Promise.resolve(hash === `hash:${text}`),
  };
  const strategy = new PasswordStrategy(
    {
      findByEmail: (email) => {
        const account = [...accounts.values()].find((a) => a.email === email);
        return account ? store.getPasswordAccount(account.id) : Promise.resolve(null);
      },
    },
    codec.verify,
  );
  const app = await buildServer({
    broker: new Broker(),
    resolver: new SessionPrincipalResolver(new SessionStrategy(sessions)),
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  servers.push(app);
  await app.register(
    identityRoutes({
      origin,
      accounts: store,
      management: new AccountService(store, codec),
      sessions,
      flow: new SessionAuthFlow([strategy], sessions),
      loginGate: new LoginGate({ attempts: 100 }),
    }),
  );
  return app;
}

async function signup(app: FastifyInstance, email = 'a@example.edu'): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin },
    payload: { email, displayName: 'A', password },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json<{ accountId: string; role: string }>();
  expect(typeof body.accountId).toBe('string');
  expect(body.role).toBe('user');
  return response.cookies[0]!.value;
}

describe('identity: signup and account HTTP workflow', () => {
  it('signs up, reads the account, and signs in with the created credential', async () => {
    const app = await setup();
    const token = await signup(app, ' A@Example.edu ');
    const me = await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ email: string }>().email).toBe('a@example.edu');
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'a@example.edu', password },
    });
    expect(login.statusCode).toBe(200);
  });

  it('returns 409 on duplicate normalized email without issuing a cookie', async () => {
    const app = await setup();
    await signup(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email: ' A@Example.edu ', displayName: 'Other', password },
    });
    expect(response.statusCode).toBe(409);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('updates only the signed-in account and requires current proof for email', async () => {
    const app = await setup();
    const token = await signup(app);
    const other = await signup(app, 'other@example.edu');
    const cookies = { [AUTH_COOKIE]: token };
    const name = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { origin },
      cookies,
      payload: { displayName: 'Updated' },
    });
    expect(name.statusCode).toBe(200);
    const denied = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { origin },
      cookies,
      payload: { email: 'new@example.edu', currentPassword: 'wrong' },
    });
    expect(denied.statusCode).toBe(401);
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { origin },
      cookies,
      payload: { email: 'new@example.edu', currentPassword: password },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json<{ email: string }>().email).toBe('new@example.edu');
    const untouched = await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: other } });
    expect(untouched.json<{ email: string }>().email).toBe('other@example.edu');
    const takeover = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { origin },
      cookies,
      payload: { accountId: 'account-2', role: 'staff' },
    });
    expect(takeover.statusCode).toBe(400);
  });

  it('changes a password without invalidating existing sessions under the current policy', async () => {
    const app = await setup();
    const token = await signup(app);
    const next = 'a different long passphrase';
    const changed = await app.inject({
      method: 'POST',
      url: '/api/me/password',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: token },
      payload: { currentPassword: password, newPassword: next },
    });
    expect(changed.statusCode).toBe(204);
    for (const [secret, status] of [
      [password, 401],
      [next, 200],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email: 'a@example.edu', password: secret },
      });
      expect(response.statusCode).toBe(status);
    }
    expect(
      (await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: token } })).statusCode,
    ).toBe(200);
  });

  it('protects every new mutation with origin checks and authentication where required', async () => {
    const app = await setup();
    for (const [method, url] of [
      ['POST', '/api/auth/signup'],
      ['PATCH', '/api/me'],
      ['POST', '/api/me/password'],
    ] as const) {
      const denied = await app.inject({
        method,
        url,
        headers: { origin: 'https://attacker.example' },
        payload: {},
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.headers['cache-control']).toBe('no-store');
      if (url !== '/api/auth/signup') {
        expect(
          (await app.inject({ method, url, headers: { origin }, payload: {} })).statusCode,
        ).toBe(401);
      }
    }
  });

  it('rejects weak registration passwords and roles without creating an account', async () => {
    const app = await setup();
    for (const payload of [
      { email: 'a@example.edu', displayName: 'A', password: 'short' },
      { email: 'a@example.edu', displayName: 'A', password, role: 'staff' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin },
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    await signup(app);
  });
});
