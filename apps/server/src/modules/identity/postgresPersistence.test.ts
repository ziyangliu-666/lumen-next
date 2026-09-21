import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { openDatabase, type Db } from '../../core/db/db.js';
import { AccountService } from './accountService.js';
import { AuthSessions } from './authSessions.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';

function stores(db: Db): { accounts: PostgresAccountStore; sessions: AuthSessions } {
  return {
    accounts: new PostgresAccountStore(db),
    sessions: new AuthSessions(new PostgresAuthSessionStore(db), { lifetimeMs: 60000 }),
  };
}

describe.skipIf(!TEST_DATABASE_URL)('identity: PostgreSQL persistence across pool restarts', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  beforeAll(async () => {
    fixture = await openTestDb();
  });
  afterAll(async () => {
    await fixture?.drop();
  });
  it('persists credentials, cookies and revocation across independent connections', async () => {
    const schema = (
      await fixture.db.query<{ schema: string }>('select current_schema() as schema')
    )[0]!.schema;
    const connect = (): Promise<Db> => openDatabase(TEST_DATABASE_URL!, { schema, migrate: false });
    let db = await connect();
    try {
      const first = stores(db);
      const password = 'persistence-test-password';
      const account = await new AccountService(first.accounts).signup({
        email: 'persist@example.test',
        displayName: 'Persist',
        password,
      });
      const issued = await first.sessions.issue({ accountId: account.id, role: 'user' });
      await db.close();
      db = await connect();
      const second = stores(db);
      expect(await second.sessions.verify(issued.token)).toEqual(issued.principal);
      expect(
        await new PasswordStrategy(second.accounts).verify({ email: account.email, password }),
      ).toMatchObject(issued.principal);
      await second.sessions.revoke(issued.token);
      await db.close();
      db = await connect();
      expect(await stores(db).sessions.verify(issued.token)).toBeNull();
    } finally {
      await db.close();
    }
  });
});
