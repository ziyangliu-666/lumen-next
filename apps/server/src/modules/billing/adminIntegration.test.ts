import { expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
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
      for (const url of [
        '/api/admin/accounts',
        `/api/admin/accounts/${staff.id}`,
        '/api/admin/ledger',
        `/api/admin/accounts/${member.id}/wallet`,
      ]) {
        expect(
          (await app.server.inject({ url, headers: { cookie: member.cookie } })).statusCode,
        ).toBe(403);
        expect(
          (await app.server.inject({ url, headers: { authorization: 'stub fake:staff' } }))
            .statusCode,
        ).toBe(401);
      }
      // Billing fixtures write only billing's table; deletion uses identity's HTTP API.
      await db.query(
        "insert into ledger_entries (account_id, amount, reason) values ($1, 0.123456, 'expense')",
        [member.id],
      );
      const readLedger = (): Promise<LightMyRequestResponse> =>
        app.server.inject({ url: '/api/admin/ledger', headers: { cookie } });
      const before = (await readLedger()).json<{ entries: { id: string; createdAt: string }[] }>();
      expect(before.entries).toEqual([
        expect.objectContaining({ accountId: member.id, accountLabel: 'Admin test' }),
      ]);
      const walletUrl = `/api/admin/accounts/${member.id}/wallet`;
      const readWallet = (): Promise<LightMyRequestResponse> =>
        app.server.inject({ url: walletUrl, headers: { cookie } });
      expect((await readWallet()).json()).toEqual({
        spent: { dollars: 0.123456 },
        cap: { dollars: 1 },
      });
      const saved = await app.server.inject({
        method: 'PATCH',
        url: '/api/wallet/cap',
        headers: { origin, cookie: member.cookie },
        payload: { cap: { dollars: 0 } },
      });
      expect(saved.statusCode).toBe(200);
      expect((await readWallet()).json()).toEqual(saved.json());
      expect(
        (
          await app.server.inject({
            url: `/api/admin/accounts/${staff.id}/wallet`,
            headers: { cookie },
          })
        ).json(),
      ).toEqual({ spent: { dollars: 0 }, cap: { dollars: 1 } });
      const deleted = await app.server.inject({
        method: 'DELETE',
        url: '/api/me',
        headers: { origin, cookie: member.cookie },
        payload: { currentPassword: 'correct horse battery 9' },
      });
      expect(deleted.statusCode).toBe(204);
      expect((await readWallet()).statusCode).toBe(404);
      const replacement = await signup('member@example.test');
      expect(replacement.id).not.toBe(member.id);
      const after = await readLedger();
      expect(after.statusCode).toBe(200);
      expect(after.json()).toEqual({
        entries: [
          {
            id: before.entries[0]!.id,
            accountId: member.id,
            accountLabel: 'Deleted account',
            taskId: null,
            amount: { dollars: 0.123456 },
            createdAt: before.entries[0]!.createdAt,
          },
        ],
        nextCursor: null,
      });
      expect(
        (await app.server.inject({ url: `/api/admin/accounts/${member.id}`, headers: { cookie } }))
          .statusCode,
      ).toBe(404);
      expect(
        (
          await app.server.inject({
            url: '/api/wallet/ledger',
            headers: { cookie: replacement.cookie },
          })
        ).json(),
      ).toEqual({ entries: [], nextCursor: null });
    } finally {
      await app.server.close();
      await drop();
    }
  },
);
