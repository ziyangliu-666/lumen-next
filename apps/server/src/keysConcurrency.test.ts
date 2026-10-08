import type { LightMyRequestResponse } from 'fastify';
import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { composeApp } from './app.js';
import type { Db, Queryable } from './core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';
import { secretCipherFromEnvironment } from './modules/billing/index.js';

function signal(): { promise: Promise<void>; release: () => void } {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
const origin = 'http://localhost:4000';
const password = 'correct horse battery 9';
const cipher = secretCipherFromEnvironment({
  BILLING_SECRET_KEYRING: JSON.stringify({ test: randomBytes(32).toString('base64') }),
  BILLING_SECRET_ACTIVE_KEY_ID: 'test',
})!;

it.skipIf(!TEST_DATABASE_URL).each(['save', 'delete', 'rollback'] as const)(
  'joins real ciphertext and account deletion in one lifecycle (%s first)',
  async (order) => {
    const { db, drop } = await openTestDb();
    const locked = signal();
    const finish = signal();
    let armed = false;
    let pid = 0;
    const instrument = (tx: Queryable): Queryable => ({
      async query<T extends object>(sql: string, params?: readonly unknown[]): Promise<T[]> {
        const rows = await tx.query<T>(sql, params);
        if (
          armed &&
          sql.includes(
            order === 'save' ? 'insert into billing_secrets' : 'delete from billing_secrets',
          )
        ) {
          armed = false;
          if (order === 'rollback') throw new Error('synthetic cleanup failure');
          pid = (await tx.query<{ pid: number }>('select pg_backend_pid() as pid'))[0]!.pid;
          locked.release();
          await finish.promise;
        }
        return rows;
      },
    });
    const joined: Db = {
      query: (sql, params) => db.query(sql, params),
      close: () => db.close(),
      withTransaction: (work) => db.withTransaction((tx) => work(instrument(tx))),
    };
    const app = await composeApp({
      db: joined,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      secretCipher: cipher,
      logLevel: 'silent',
    });
    try {
      const signup = await app.server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin },
        payload: { email: 'race@example.test', password, displayName: 'Race' },
      });
      expect(signup.statusCode).toBe(201);
      const id = signup.json<{ accountId: string }>().accountId;
      const cookie = signup.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
      const save = (): Promise<LightMyRequestResponse> =>
        app.server.inject({
          method: 'PUT',
          url: '/api/keys/openai',
          headers: { cookie, origin },
          payload: { value: 'synthetic-race-key' },
        });
      const erase = (): Promise<LightMyRequestResponse> =>
        app.server.inject({
          method: 'DELETE',
          url: '/api/me',
          headers: { cookie, origin },
          payload: { currentPassword: password },
        });
      expect((await save()).statusCode).toBe(204);
      armed = true;
      if (order === 'rollback') {
        expect((await erase()).statusCode).toBe(500);
        expect((await app.server.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(
          200,
        );
        const rows = await db.query<{ envelope: unknown }>(
          'select envelope from billing_secrets where account_id = $1',
          [id],
        );
        expect(cipher.open({ accountId: id, provider: 'openai' }, rows[0]!.envelope)).toBe(
          'synthetic-race-key',
        );
      } else {
        const first = Promise.resolve(order === 'save' ? save() : erase());
        await locked.promise;
        const second = Promise.resolve(order === 'save' ? erase() : save());
        try {
          let waiting = false;
          for (let n = 0; n < 150; n++) {
            waiting = (
              await db.query<{ waiting: boolean }>(
                'select exists (select 1 from pg_stat_activity where $1::integer = any(pg_blocking_pids(pid))) as waiting',
                [pid],
              )
            )[0]!.waiting;
            if (waiting) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
        } finally {
          finish.release();
        }
        expect((await first).statusCode).toBe(204);
        expect((await second).statusCode).toBe(order === 'save' ? 204 : 403);
        expect(await db.query('select 1 from billing_secrets where account_id = $1', [id])).toEqual(
          [],
        );
      }
    } finally {
      finish.release();
      await app.server.close();
      await drop();
    }
  },
);
