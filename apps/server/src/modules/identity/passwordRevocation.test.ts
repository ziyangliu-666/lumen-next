import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import { LoginGate } from './loginGate.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { AuthSessions } from './authSessions.js';
import type { IdentityDatabase } from './identityDatabase.js';

describe.skipIf(!TEST_DATABASE_URL)('identity: password change session revocation', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  beforeAll(async () => {
    fixture = await openTestDb();
  });
  afterAll(async () => {
    await fixture?.drop();
  });

  it('rolls back the new credential if session revocation fails', async () => {
    const accounts = new PostgresAccountStore(fixture.db);
    const account = await accounts.createPasswordAccount({
      email: 'rollback-change@example.test',
      displayName: 'Rollback',
      passwordHash: 'old-hash',
    });
    const sessions = new AuthSessions(new PostgresAuthSessionStore(fixture.db), {
      lifetimeMs: 60000,
    });
    const issued = await sessions.issue({ accountId: account.id, role: 'user' });
    const failing: IdentityDatabase = {
      query: (text, values) => fixture.db.query(text, values),
      withTransaction: (work) =>
        fixture.db.withTransaction((tx) =>
          work({
            query: (text, values) => {
              if (text.startsWith('delete from auth_sessions'))
                throw new Error('Injected revocation failure');
              return tx.query(text, values);
            },
          }),
        ),
    };
    await expect(
      new PostgresAccountStore(failing).replacePassword(account.id, 'old-hash', 'new-hash'),
    ).rejects.toThrow('Injected revocation failure');
    expect((await accounts.getPasswordAccount(account.id))?.passwordHash).toBe('old-hash');
    expect(await sessions.verify(issued.token)).not.toBeNull();
    expect(await accounts.replacePassword(account.id, 'old-hash', 'new-hash')).toBe(true);
    expect(await sessions.verify(issued.token)).toBeNull();
  });

  it('keeps the current cookie, revokes other cookies, and isolates other accounts', async () => {
    const origin = 'https://lumen.example';
    const identity = createIdentitySlice({
      database: fixture.db,
      origin,
      sessionLifetimeMs: 60000,
      loginGate: new LoginGate({ attempts: 50 }),
    });
    const app = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(identity.registerRoutes);
    try {
      const password = 'original-test-password';
      const signup = async (email: string): Promise<string> => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/signup',
          headers: { origin },
          payload: { email, displayName: 'Test', password },
        });
        expect(response.statusCode).toBe(201);
        return response.cookies[0]!.value;
      };
      const current = await signup('change@example.test');
      const unrelated = await signup('unrelated@example.test');
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email: 'change@example.test', password },
      });
      expect(login.statusCode).toBe(200);
      const other = login.cookies[0]!.value;
      const change = await app.inject({
        method: 'POST',
        url: '/api/me/password',
        headers: { origin },
        cookies: { lumen_session: current },
        payload: { currentPassword: password, newPassword: 'replacement-password' },
      });
      expect(change.statusCode).toBe(204);
      for (const [token, status] of [
        [current, 200],
        [other, 401],
        [unrelated, 200],
      ] as const) {
        expect(
          (await app.inject({ url: '/api/me', cookies: { lumen_session: token } })).statusCode,
        ).toBe(status);
      }
      // The replacement password, not the old one, is now the deletion proof.
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: '/api/me',
            headers: { origin },
            cookies: { lumen_session: current },
            payload: { currentPassword: 'replacement-password' },
          })
        ).statusCode,
      ).toBe(204);
    } finally {
      await app.close();
    }
  });
});
