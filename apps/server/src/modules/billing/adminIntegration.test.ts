import { expect, it } from 'vitest';
import { composeApp } from '../../app.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { createIdentitySlice, LoginGate } from '../identity/index.js';

it.skipIf(!TEST_DATABASE_URL)(
  'composes staff administration with real identity cookies and storage',
  async () => {
    const { db, drop } = await openTestDb();
    const origin = 'http://localhost:4000';
    const app = await composeApp({
      db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      logLevel: 'silent',
    });
    try {
      const signup = async (email: string): Promise<{ id: string; cookie: string }> => {
        const result = await app.server.inject({
          method: 'POST',
          url: '/api/auth/signup',
          headers: { origin },
          payload: { email, displayName: 'Admin test', password: 'correct horse battery 9' },
        });
        expect(result.statusCode).toBe(201);
        return {
          id: result.json<{ accountId: string }>().accountId,
          cookie: result.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
        };
      };
      const staff = await signup('staff@example.test');
      const member = await signup('member@example.test');
      // Set up staff through identity's public API, never its tables.
      const identity = createIdentitySlice({
        database: db,
        origin,
        sessionLifetimeMs: 3600000,
        loginGate: new LoginGate(),
        secureCookies: false,
      });
      await identity.setRole(staff.id, 'staff');
      const login = await app.server.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email: 'staff@example.test', password: 'correct horse battery 9' },
      });
      expect(login.statusCode).toBe(200);
      const cookie = login.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
      const list = await app.server.inject({ url: '/api/admin/accounts', headers: { cookie } });
      expect(list.statusCode).toBe(200);
      expect(list.json<{ accounts: { id: string }[] }>().accounts.map((row) => row.id)).toEqual(
        expect.arrayContaining([staff.id, member.id]),
      );
      const detail = await app.server.inject({
        url: `/api/admin/accounts/${member.id}`,
        headers: { cookie },
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({
        account: { id: member.id, email: 'member@example.test', role: 'user' },
      });
      for (const url of ['/api/admin/accounts', `/api/admin/accounts/${staff.id}`]) {
        expect(
          (await app.server.inject({ url, headers: { cookie: member.cookie } })).statusCode,
        ).toBe(403);
        expect(
          (await app.server.inject({ url, headers: { authorization: 'stub fake:staff' } }))
            .statusCode,
        ).toBe(401);
      }
    } finally {
      await app.server.close();
      await drop();
    }
  },
);
