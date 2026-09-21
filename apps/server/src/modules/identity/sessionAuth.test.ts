import { describe, expect, it, vi } from 'vitest';
import { requireUser } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AuthSessions, type StoredAuthSession } from './authSessions.js';
import { SessionAuthFlow } from './sessionAuthFlow.js';
import { AUTH_COOKIE, SessionPrincipalResolver, SessionStrategy } from './sessionStrategy.js';

const principal = { accountId: 'account-1', role: 'user' as const };

// A test-only adapter exercises the boundary. It is not production persistence.
function harness(): {
  sessions: AuthSessions;
  insert: ReturnType<typeof vi.fn>;
  records: Map<string, StoredAuthSession>;
} {
  const records = new Map<string, StoredAuthSession>();
  const insert = vi.fn(({ tokenHash, expiresAt }: { tokenHash: string; expiresAt: number }) => {
    records.set(tokenHash, { principal, expiresAt, suspended: false });
    return Promise.resolve();
  });
  const sessions = new AuthSessions(
    {
      insert,
      findByTokenHash: (hash) => Promise.resolve(records.get(hash) ?? null),
      deleteByTokenHash: (hash) => {
        records.delete(hash);
        return Promise.resolve();
      },
      deleteByAccountId: (id) => {
        for (const [hash, record] of records) {
          if (record.principal.accountId === id) records.delete(hash);
        }
        return Promise.resolve();
      },
    },
    { lifetimeMs: 1000, now: () => 1000 },
  );
  return { sessions, insert, records };
}

describe('identity: session authentication integration', () => {
  it('plugs into core request resolution and requireUser without changing core', async () => {
    const { sessions } = harness();
    const { token } = await sessions.issue(principal);
    const app = await buildServer({
      broker: new Broker(),
      resolver: new SessionPrincipalResolver(new SessionStrategy(sessions)),
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    try {
      app.get('/identity-test/protected', (request) => requireUser(request));
      const anonymous = await app.inject('/identity-test/protected');
      expect(anonymous.statusCode).toBe(401);
      const forged = await app.inject({
        url: '/identity-test/protected',
        headers: { authorization: 'stub attacker:staff' },
      });
      expect(forged.statusCode).toBe(401);
      const authenticated = await app.inject({
        url: '/identity-test/protected',
        cookies: { [AUTH_COOKIE]: token },
      });
      expect(authenticated.statusCode).toBe(200);
      expect(authenticated.json<unknown>()).toEqual(principal);
      await sessions.revoke(token);
      const revoked = await app.inject({
        url: '/identity-test/protected',
        cookies: { [AUTH_COOKIE]: token },
      });
      expect(revoked.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
  it('runs the shared completion once then resolves cookies without creating sessions', async () => {
    const { sessions, insert } = harness();
    const flow = new SessionAuthFlow(
      [{ kind: 'password', verify: () => Promise.resolve(principal) }],
      sessions,
    );
    const issued = await flow.authenticate('password', {});
    const strategy = new SessionStrategy(sessions);
    const resolver = new SessionPrincipalResolver(strategy);
    expect(strategy.kind).toBe('session');
    expect(AUTH_COOKIE).toBe('lumen_session');
    for (let i = 0; i < 3; i += 1) {
      await expect(resolver.resolve({ cookies: { [AUTH_COOKIE]: issued.token } })).resolves.toEqual(
        principal,
      );
    }
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('rejects a failed proof without issuing anything', async () => {
    const { sessions, insert } = harness();
    const flow = new SessionAuthFlow(
      [{ kind: 'password', verify: () => Promise.resolve(null) }],
      sessions,
    );
    await expect(flow.authenticate('password', {})).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('propagates persistence failure from the completion hook', async () => {
    const failure = new Error('write unavailable');
    const flow = new SessionAuthFlow(
      [{ kind: 'password', verify: () => Promise.resolve(principal) }],
      {
        issue: () => Promise.reject(failure),
      },
    );
    await expect(flow.authenticate('password', {})).rejects.toBe(failure);
  });

  it('never accepts stub headers or stub cookies without a real session cookie', async () => {
    const { sessions } = harness();
    const resolver = new SessionPrincipalResolver(new SessionStrategy(sessions));
    await expect(
      resolver.resolve({ authorization: 'stub account-1:staff', cookies: {} }),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve({ cookies: { lumen_stub: 'stub account-1:staff' } }),
    ).resolves.toBeNull();
  });

  it('ignores a forged header when resolving the actual cookie account', async () => {
    const { sessions } = harness();
    const { token } = await sessions.issue(principal);
    const resolver = new SessionPrincipalResolver(new SessionStrategy(sessions));
    await expect(
      resolver.resolve({ authorization: 'stub attacker:staff', cookies: { [AUTH_COOKIE]: token } }),
    ).resolves.toEqual(principal);
  });

  it('does not fall back to a header when a cookie is invalid', async () => {
    const { sessions } = harness();
    const resolver = new SessionPrincipalResolver(new SessionStrategy(sessions));
    await expect(
      resolver.resolve({
        authorization: 'stub account-1:staff',
        cookies: { [AUTH_COOKIE]: 'forged' },
      }),
    ).resolves.toBeNull();
  });

  it('rejects revoked tokens on subsequent requests while keeping other sessions', async () => {
    const { sessions } = harness();
    const first = await sessions.issue(principal);
    const second = await sessions.issue(principal);
    const strategy = new SessionStrategy(sessions);
    await sessions.revoke(first.token);
    await expect(strategy.verify(first.token)).resolves.toBeNull();
    await expect(strategy.verify(second.token)).resolves.toEqual(principal);
    await sessions.revokeAll(principal.accountId);
    await expect(strategy.verify(second.token)).resolves.toBeNull();
  });

  it('does not hide resolver storage failures as anonymous access', async () => {
    const failure = new Error('read unavailable');
    const resolver = new SessionPrincipalResolver(
      new SessionStrategy({ verify: () => Promise.reject(failure) }),
    );
    await expect(resolver.resolve({ cookies: {} })).rejects.toBe(failure);
  });
});
