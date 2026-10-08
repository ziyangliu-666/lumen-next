import { expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { IdentitySql } from './identityDatabase.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import { LoginGate } from './loginGate.js';
import { PostgresAccountStore } from './postgresStores.js';

it.skipIf(!TEST_DATABASE_URL)(
  'rolls back suspension when session cleanup fails inside the actor-authorized transaction',
  async () => {
    const { db, drop } = await openTestDb();
    try {
      const store = new PostgresAccountStore(db);
      const create = (email: string): ReturnType<PostgresAccountStore['createPasswordAccount']> =>
        store.createPasswordAccount({
          email,
          displayName: 'Rollback fixture',
          passwordHash: 'synthetic-version',
        });
      const actor = await create('actor@example.test');
      const target = await create('target@example.test');
      await store.setRole(actor.id, 'staff');
      const failure = new Error('synthetic cleanup failure');
      const instrument = (tx: IdentitySql): IdentitySql => ({
        query: <T extends object>(sql: string, params: readonly unknown[]): Promise<T[]> => {
          if (sql.startsWith('delete from auth_sessions')) return Promise.reject(failure);
          return tx.query<T>(sql, params);
        },
      });
      const identity = createIdentitySlice({
        database: {
          query: (sql, params) => db.query(sql, params),
          withTransaction: (work) => db.withTransaction((tx) => work(instrument(tx))),
        },
        origin: 'https://example.test',
        sessionLifetimeMs: 3600000,
        loginGate: new LoginGate(),
      });
      await expect(identity.changeAccount(actor.id, target.id, { suspended: true })).rejects.toBe(
        failure,
      );
      expect((await identity.getAccount(target.id))?.suspended).toBe(false);
      expect(await identity.canSpend(target.id)).toBe(true);
      await expect(
        identity.changeAccount(actor.id.toUpperCase(), actor.id, { role: 'user' }),
      ).rejects.toMatchObject({ code: 'self_change' });
    } finally {
      await drop();
    }
  },
);
