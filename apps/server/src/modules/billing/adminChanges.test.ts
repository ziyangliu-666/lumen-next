import type { LightMyRequestResponse } from 'fastify';
import { expect, it } from 'vitest';
import { composeApp } from '../../app.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { createIdentitySlice, LoginGate } from '../identity/index.js';

const origin = 'http://localhost:4000';
const password = 'correct horse battery 9';
it.skipIf(!TEST_DATABASE_URL)(
  'changes account access through real staff cookies, revokes sessions and prevents self-lockout',
  async () => {
    const { db, drop } = await openTestDb();
    const app = await composeApp({
      db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      logLevel: 'silent',
    });
    const identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 3600000,
      secureCookies: false,
      loginGate: new LoginGate(),
    });
    try {
      const signup = async (email: string): Promise<{ id: string; cookie: string }> => {
        const response = await app.server.inject({
          method: 'POST',
          url: '/api/auth/signup',
          headers: { origin },
          payload: { email, password, displayName: 'Admin change fixture' },
        });
        expect(response.statusCode).toBe(201);
        return {
          id: response.json<{ accountId: string }>().accountId,
          cookie: response.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
        };
      };
      const staff = await signup('admin@example.test');
      const member = await signup('member@example.test');
      await identity.setRole(staff.id, 'staff');
      const patch = (
        id: string,
        body: object,
        cookie = staff.cookie,
        requestOrigin = origin,
      ): Promise<LightMyRequestResponse> =>
        app.server.inject({
          method: 'PATCH',
          url: `/api/admin/accounts/${id}`,
          headers: { origin: requestOrigin, cookie },
          payload: body,
        });
      expect((await patch(member.id, { role: 'staff' }, '')).statusCode).toBe(401);
      expect((await patch(staff.id, { role: 'staff' }, member.cookie)).statusCode).toBe(403);
      expect(
        (await patch(member.id, { role: 'staff' }, staff.cookie, 'https://evil.example'))
          .statusCode,
      ).toBe(403);
      for (const body of [
        {},
        { role: 'owner' },
        { suspended: 'true' },
        { role: 'staff', suspended: true },
        { email: 'new@example.test' },
        { role: 'staff', actorId: member.id },
      ])
        expect((await patch(member.id, body)).statusCode).toBe(400);
      expect((await patch('invalid', { role: 'staff' })).statusCode).toBe(400);
      for (const body of [{ role: 'user' }, { suspended: true }])
        expect((await patch(staff.id, body)).statusCode).toBe(403);
      const promoted = await patch(member.id, { role: 'staff' });
      expect(promoted.statusCode).toBe(200);
      expect(promoted.headers['cache-control']).toBe('no-store');
      expect(promoted.json()).toMatchObject({ account: { id: member.id, role: 'staff' } });
      expect(
        (
          await app.server.inject({
            url: '/api/admin/accounts',
            headers: { cookie: member.cookie },
          })
        ).statusCode,
      ).toBe(200);
      expect((await patch(member.id, { role: 'user' })).statusCode).toBe(200);
      expect(
        (
          await app.server.inject({
            url: '/api/admin/accounts',
            headers: { cookie: member.cookie },
          })
        ).statusCode,
      ).toBe(403);
      await expect(
        identity.changeAccount(member.id, staff.id, { suspended: true }),
      ).rejects.toMatchObject({ code: 'actor_forbidden' });
      expect((await patch(member.id, { suspended: true })).statusCode).toBe(200);
      expect(
        (await app.server.inject({ url: '/api/me', headers: { cookie: member.cookie } }))
          .statusCode,
      ).toBe(401);
      const login = (): Promise<LightMyRequestResponse> =>
        app.server.inject({
          method: 'POST',
          url: '/api/auth/password',
          headers: { origin },
          payload: { email: 'member@example.test', password },
        });
      expect((await login()).statusCode).toBe(401);
      expect(await identity.canSpend(member.id)).toBe(false);
      expect((await patch(member.id, { suspended: false })).statusCode).toBe(200);
      expect(
        (await app.server.inject({ url: '/api/me', headers: { cookie: member.cookie } }))
          .statusCode,
      ).toBe(401);
      const fresh = await login();
      expect(fresh.statusCode).toBe(200);
      const cookie = fresh.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
      expect(
        (
          await app.server.inject({
            method: 'DELETE',
            url: '/api/me',
            headers: { cookie, origin },
            payload: { currentPassword: password },
          })
        ).statusCode,
      ).toBe(204);
      expect((await patch(member.id, { suspended: false })).statusCode).toBe(404);
      // Two staff cannot concurrently demote each other and leave no active staff.
      const second = await signup('second@example.test');
      await identity.setRole(second.id, 'staff');
      const results = await Promise.all([
        patch(second.id, { role: 'user' }),
        patch(staff.id, { role: 'user' }, second.cookie),
      ]);
      expect(results.map((response) => response.statusCode).sort()).toEqual([200, 403]);
      expect(
        (await identity.listAccounts()).filter(
          (account) => account.role === 'staff' && !account.suspended,
        ),
      ).toHaveLength(1);
    } finally {
      await app.server.close();
      await drop();
    }
  },
);
