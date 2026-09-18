import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountDeletion } from './accountDeletion.js';
import { AuthSessions } from './authSessions.js';
import { MailActions } from './mailActions.js';
import { OAuthAccounts, OAuthAttempts } from './oauth.js';
import { hashPassword, verifyPassword } from './passwordHash.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { postgresDatabase, type IdentityPgPool } from './postgresDatabase.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';

// Explicit opt-in only. Never fall back to the application's DATABASE_URL.
// Supply an externally installed pg driver and a disposable PostgreSQL database.
const modulePath = process.env['IDENTITY_PG_MODULE'];
const connectionString = process.env['IDENTITY_PG_TEST_URL'];
interface TestPool extends IdentityPgPool {
  end(): Promise<void>;
}
interface PoolOptions {
  connectionString: string;
  max: number;
  options: string;
  application_name: string;
  connectionTimeoutMillis: number;
}
function latch(): { promise: Promise<void>; open: () => void } {
  let open = (): void => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

// Run serially: each test owns its accounts, and lock observation is suite-scoped.
describe.skipIf(!modulePath && !connectionString)('identity: real PostgreSQL acceptance', () => {
  const schema = `identity_test_${randomUUID().replaceAll('-', '')}`;
  let pool: TestPool | undefined;
  let admin: TestPool | undefined;
  let db: IdentityDatabase;
  let accounts: PostgresAccountStore;
  let sessions: PostgresAuthSessionStore;
  let schemaCreated = false;

  beforeAll(async () => {
    if (process.env['NODE_ENV'] === 'production') throw new Error('Test refuses production mode');
    if (!modulePath || !connectionString) {
      throw new Error('Set both IDENTITY_PG_MODULE and IDENTITY_PG_TEST_URL');
    }
    const url = new URL(connectionString);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      ['options', 'application_name'].some((key) => url.searchParams.has(key))
    ) {
      throw new Error('Test URL must not override schema isolation or lock observation settings');
    }
    const loaded = (await import(pathToFileURL(modulePath).href)) as {
      Pool: new (options: PoolOptions) => TestPool;
    };
    const options: PoolOptions = {
      connectionString,
      max: 4,
      // No public fallback: unqualified DDL/DML must stay in our new schema.
      options: `-c search_path=${schema} -c statement_timeout=10000 -c lock_timeout=8000`,
      application_name: schema,
      connectionTimeoutMillis: 5000,
    };
    admin = new loaded.Pool(options);
    await admin.query(`create schema "${schema}"`);
    schemaCreated = true;
    pool = new loaded.Pool(options);
    db = postgresDatabase(pool);
    accounts = new PostgresAccountStore(db);
    sessions = new PostgresAuthSessionStore(db);
    await db.withTransaction(async (sql) => {
      const scope = await sql.query<{ schema: string }>('select current_schema() as schema', []);
      if (scope[0]?.schema !== schema) throw new Error('Test schema isolation was not applied');
      for (const path of [
        '../../core/db/schema.sql',
        './migrations/002_identity_auth.sql',
        './migrations/003_identity_oauth.sql',
        './migrations/004_identity_mail.sql',
      ]) {
        await sql.query(await readFile(new URL(path, import.meta.url), 'utf8'), []);
      }
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      try {
        // The name is generated here, never supplied by a caller. No existing
        // schema, database, or application table is truncated or dropped.
        if (schemaCreated) await admin?.query(`drop schema "${schema}" cascade`);
      } finally {
        await admin?.end();
      }
    }
  }, 30_000);

  function signup(
    email = `${randomUUID()}@example.test`,
  ): ReturnType<PostgresAccountStore['createPasswordAccount']> {
    return accounts.createPasswordAccount({ email, displayName: 'Test', passwordHash: 'old-hash' });
  }

  async function waitForBlockedConnection(): Promise<void> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const rows = await db.query<{ blocked: boolean }>(
        `select exists (
          select 1 from pg_stat_activity where application_name = $1
          and cardinality(pg_blocking_pids(pid)) > 0
        ) as blocked`,
        [schema],
      );
      if (rows[0]?.blocked) return;
      await delay(20);
    }
    throw new Error('Expected a real blocked PostgreSQL connection');
  }

  // Pause AFTER the writer has acquired its real row lock. The competing writer
  // must then be observed waiting in PostgreSQL, not merely launched concurrently.
  async function race(
    lockQuery: string,
    first: (database: IdentityDatabase) => Promise<unknown>,
    second: () => Promise<unknown>,
  ): Promise<PromiseSettledResult<unknown>[]> {
    const locked = latch();
    const release = latch();
    const held: IdentityDatabase = {
      query: <Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]> =>
        db.query<Row>(text, values),
      withTransaction: (work) =>
        db.withTransaction((sql) =>
          work({
            async query<Row extends object>(
              text: string,
              values: readonly unknown[],
            ): Promise<Row[]> {
              const rows = await sql.query<Row>(text, values);
              if (text.startsWith(lockQuery)) {
                locked.open();
                await release.promise;
              }
              return rows;
            },
          }),
        ),
    };
    const firstResult = first(held);
    // Attach rejection handlers immediately, including when setup fails.
    const firstSettled = Promise.allSettled([firstResult]);
    let all: Promise<PromiseSettledResult<unknown>[]> = firstSettled;
    try {
      await Promise.race([
        locked.promise,
        firstResult.then(() => {
          throw new Error('Writer did not acquire the expected lock');
        }),
      ]);
      all = Promise.allSettled([firstResult, second()]);
      await waitForBlockedConnection();
    } finally {
      release.open();
      await all;
    }
    return all;
  }

  it('uses independent backend connections and confines tables to its random schema', async () => {
    const first = await pool!.connect();
    const second = await pool!.connect();
    try {
      const a = await first.query<{ pid: number; schema: string }>(
        'select pg_backend_pid() as pid, current_schema() as schema',
      );
      const b = await second.query<{ pid: number }>('select pg_backend_pid() as pid');
      expect(a.rows[0]?.pid).not.toBe(b.rows[0]?.pid);
      expect(a.rows[0]?.schema).toBe(schema);
    } finally {
      first.release();
      second.release();
    }
  });

  it('allows only one concurrent normalized-email signup without orphan credentials', async () => {
    const email = `${randomUUID()}@example.test`;
    const results = await Promise.allSettled([signup(email), signup(` ${email.toUpperCase()} `)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'email_taken' },
    });
    const rows = await db.query<{ count: number }>(
      `select count(*)::int as count from credentials c join accounts a on a.id = c.account_id
       where a.email = $1`,
      [email],
    );
    expect(rows).toEqual([{ count: 1 }]);
  });

  it('accepts only one simultaneous password change using the same proof', async () => {
    const account = await signup();
    const results = await Promise.all([
      accounts.replacePassword(account.id, 'old-hash', 'first-hash'),
      accounts.replacePassword(account.id, 'old-hash', 'second-hash'),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(['first-hash', 'second-hash']).toContain(
      (await accounts.getPasswordAccount(account.id))?.passwordHash,
    );
  });

  it('serializes concurrent first logins for one external identity', async () => {
    const profile = {
      subject: randomUUID(),
      email: `${randomUUID()}@example.test`,
      displayName: 'Provider test',
    };
    const results = await race(
      'select pg_advisory_xact_lock',
      (database) => new OAuthAccounts(database).resolve('github', profile),
      () => new OAuthAccounts(db).resolve('github', profile),
    );
    expect(results[0]).toMatchObject({ status: 'fulfilled' });
    expect(results[1]).toEqual(results[0]);
    expect(
      await db.query('select id from accounts where email = $1', [profile.email]),
    ).toHaveLength(1);
    expect(
      await db.query('select id from credentials where external_id = $1', [profile.subject]),
    ).toHaveLength(1);
  }, 20_000);

  it('does not link different provider identities racing for the same email', async () => {
    const email = `${randomUUID()}@example.test`;
    const results = await race(
      'insert into accounts',
      (database) =>
        new OAuthAccounts(database).resolve('github', {
          subject: randomUUID(),
          email,
          displayName: 'First provider',
        }),
      () =>
        new OAuthAccounts(db).resolve('google', {
          subject: randomUUID(),
          email,
          displayName: 'Second provider',
        }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { name: 'OAuthEmailConflict' } },
    ]);
    expect(
      await db.query(
        'select c.kind from credentials c join accounts a on a.id = c.account_id where a.email = $1',
        [email],
      ),
    ).toEqual([{ kind: 'github' }]);
  }, 20_000);

  it('does not attach OAuth credentials to a concurrently created password account', async () => {
    const email = `${randomUUID()}@example.test`;
    const results = await race(
      'insert into accounts',
      (database) =>
        new PostgresAccountStore(database).createPasswordAccount({
          email,
          displayName: 'Password account',
          passwordHash: 'old-hash',
        }),
      () =>
        new OAuthAccounts(db).resolve('github', {
          subject: randomUUID(),
          email,
          displayName: 'Provider account',
        }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { name: 'OAuthEmailConflict' } },
    ]);
    expect(
      await db.query(
        'select c.kind from credentials c join accounts a on a.id = c.account_id where a.email = $1',
        [email],
      ),
    ).toEqual([{ kind: 'password' }]);
  }, 20_000);

  it('consumes an OAuth attempt only once across concurrent connections', async () => {
    const attempts = new OAuthAttempts(db);
    const attempt = await attempts.begin('github');
    const results = await Promise.allSettled([
      attempts.consume('github', attempt.state, attempt.binding),
      attempts.consume('github', attempt.state, attempt.binding),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toEqual([
      { status: 'fulfilled', value: attempt.verifier },
    ]);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'invalid_credentials' },
    });
  });

  it('propagates a real deferred-constraint COMMIT failure and leaves no partial write', async () => {
    await db.query('create table commit_parent (id integer primary key)', []);
    await db.query(
      `create table commit_child (
      parent_id integer references commit_parent(id) deferrable initially deferred
    )`,
      [],
    );
    let callbackCompleted = false;
    await expect(
      db.withTransaction(async (sql) => {
        // Valid at statement time; PostgreSQL rejects this only at COMMIT.
        await sql.query('insert into commit_child (parent_id) values (1)', []);
        callbackCompleted = true;
      }),
    ).rejects.toMatchObject({ code: '23503' });
    expect(callbackCompleted).toBe(true);
    expect(await db.query('select * from commit_child', [])).toEqual([]);
    await db.withTransaction(async (sql) => {
      await sql.query('insert into commit_parent (id) values (1)', []);
      await sql.query('insert into commit_child (parent_id) values (1)', []);
    });
    expect(await db.query('select * from commit_child', [])).toEqual([{ parent_id: 1 }]);
  });

  it('rolls back caught SQL errors and keeps the pool reusable', async () => {
    const email = `${randomUUID()}@example.test`;
    await expect(
      db.withTransaction(async (sql: IdentitySql) => {
        await sql.query('insert into accounts (email, display_name) values ($1, $2)', [
          email,
          'Rollback',
        ]);
        try {
          await sql.query('select 1 / 0', []);
        } catch {
          // A callback cannot turn an aborted PostgreSQL transaction into success.
        }
        return 'not committed';
      }),
    ).rejects.toMatchObject({ code: '22012' });
    expect(await accounts.findByEmail(email)).toBeNull();
    expect(await signup(email)).toMatchObject({ email });
  });

  async function resetFixture(): Promise<{ accountId: string; code: string; mail: MailActions }> {
    const account = await signup();
    let code = '';
    // Synthetic test mail only; this never sends externally or reads a user code.
    const mail = new MailActions(
      db,
      {
        send(message): Promise<void> {
          code = message.text.match(/\n([A-Za-z0-9_-]{43})\n/)?.[1] ?? '';
          return Promise.resolve();
        },
      },
      'https://lumen.example',
    );
    await mail.requestReset(account.email);
    expect(code).toHaveLength(43);
    return { accountId: account.id, code, mail };
  }

  const nextPassword = 'a new sufficiently long test password';
  const noMail = { send: (): Promise<void> => Promise.resolve() };

  it('accepts one concurrent reset and revokes every previous login session', async () => {
    const { accountId, code, mail } = await resetFixture();
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const old = await service.issue({ accountId, role: 'user' });
    const results = await race(
      'select email from accounts',
      (database) =>
        new MailActions(database, noMail, 'https://lumen.example').resetPassword(
          code,
          nextPassword,
        ),
      () => mail.resetPassword(code, nextPassword),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_body' } },
    ]);
    expect(await service.verify(old.token)).toBeNull();
    const account = await accounts.getPasswordAccount(accountId);
    expect(await verifyPassword(nextPassword, account!.passwordHash!)).toBe(true);
    expect(
      await db.query('select token_hash from identity_mail_tokens where account_id = $1', [
        accountId,
      ]),
    ).toEqual([]);
  }, 20_000);

  it('rejects stale password issuance queued behind a password reset', async () => {
    const { accountId, code } = await resetFixture();
    const results = await race(
      'select email from accounts',
      (database) =>
        new MailActions(database, noMail, 'https://lumen.example').resetPassword(
          code,
          nextPassword,
        ),
      () =>
        sessions.insert({
          accountId,
          expectedPasswordHash: 'old-hash',
          tokenHash: 'b'.repeat(64),
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_credentials' } },
    ]);
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [accountId]),
    ).toEqual([]);
  }, 20_000);

  it('revokes a login committed just before a waiting password reset', async () => {
    const { accountId, code, mail } = await resetFixture();
    const results = await race(
      'select id from accounts',
      (database) =>
        new PostgresAuthSessionStore(database).insert({
          accountId,
          expectedPasswordHash: 'old-hash',
          tokenHash: 'c'.repeat(64),
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        }),
      () => mail.resetPassword(code, nextPassword),
    );
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [accountId]),
    ).toEqual([]);
  }, 20_000);

  it('rejects a password reset queued behind suspension without changing credentials', async () => {
    const { accountId, code, mail } = await resetFixture();
    const results = await race(
      'update accounts set suspended',
      (database) => new PostgresAccountStore(database).suspend(accountId, true),
      () => mail.resetPassword(code, nextPassword),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_body' } },
    ]);
    expect(await accounts.getPasswordAccount(accountId)).toMatchObject({
      suspended: true,
      passwordHash: 'old-hash',
    });
  }, 20_000);

  it('rejects session issuance queued behind account deletion', async () => {
    const password = 'a sufficiently long deletion password';
    const account = await accounts.createPasswordAccount({
      email: `${randomUUID()}@example.test`,
      displayName: 'Delete test',
      passwordHash: await hashPassword(password),
    });
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const old = await service.issue({ accountId: account.id, role: 'user' });
    const results = await race(
      'select id from accounts',
      (database) => new AccountDeletion(database).remove(account.id, { currentPassword: password }),
      () => service.issue({ accountId: account.id, role: 'user' }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_credentials' } },
    ]);
    expect(await accounts.getPasswordAccount(account.id)).toBeNull();
    expect(await service.verify(old.token)).toBeNull();
    expect(
      await db.query('select id from credentials where account_id = $1', [account.id]),
    ).toEqual([]);
  }, 20_000);

  it('rejects deletion queued behind suspension without losing account data', async () => {
    const password = 'a sufficiently long deletion password';
    const account = await accounts.createPasswordAccount({
      email: `${randomUUID()}@example.test`,
      displayName: 'Suspended deletion test',
      passwordHash: await hashPassword(password),
    });
    const results = await race(
      'update accounts set suspended',
      (database) => new PostgresAccountStore(database).suspend(account.id, true),
      () => new AccountDeletion(db).remove(account.id, { currentPassword: password }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_credentials' } },
    ]);
    expect(await accounts.getPasswordAccount(account.id)).toMatchObject({ suspended: true });
    expect(
      await db.query('select id from credentials where account_id = $1', [account.id]),
    ).toHaveLength(1);
  }, 20_000);

  it('rejects issuance queued behind suspension and does not restore old sessions', async () => {
    const account = await signup();
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const principal = { accountId: account.id, role: 'user' as const };
    const old = await service.issue(principal);
    const results = await race(
      'update accounts set suspended',
      (database) => new PostgresAccountStore(database).suspend(account.id, true),
      () => service.issue(principal),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled' },
      { status: 'rejected', reason: { code: 'invalid_credentials' } },
    ]);
    await accounts.suspend(account.id, false);
    expect(await service.verify(old.token)).toBeNull();
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [account.id]),
    ).toEqual([]);
  }, 20_000);

  it('revokes issuance that commits immediately before a waiting suspension', async () => {
    const account = await signup();
    const results = await race(
      'select id from accounts',
      (database) =>
        new AuthSessions(new PostgresAuthSessionStore(database), { lifetimeMs: 60_000 }).issue({
          accountId: account.id,
          role: 'user',
        }),
      () => accounts.suspend(account.id, true),
    );
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    await accounts.suspend(account.id, false);
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [account.id]),
    ).toEqual([]);
  }, 20_000);

  it('rechecks stale password proofs after waiting for a concurrent credential update', async () => {
    const account = await signup();
    const results = await race(
      'select id from accounts',
      (database) =>
        new PostgresAccountStore(database).replacePassword(account.id, 'old-hash', 'new-hash'),
      () =>
        sessions.insert({
          accountId: account.id,
          expectedPasswordHash: 'old-hash',
          tokenHash: 'a'.repeat(64),
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        }),
    );
    expect(results).toMatchObject([
      { status: 'fulfilled', value: true },
      { status: 'rejected', reason: { code: 'invalid_credentials' } },
    ]);
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [account.id]),
    ).toEqual([]);
  }, 20_000);
});
