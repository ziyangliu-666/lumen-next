import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AdminAccountFailure } from './adminAccounts.js';
import { AuthSessions } from './authSessions.js';
import { createIdentitySlice, type IdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { OAuthAccounts } from './oauth.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

const origin = 'https://lumen.example';
const password = 'testpass';
const hex = (value: string): string => createHash('sha256').update(value).digest('hex');

// Every table identity keeps about a person, keyed by account id.
const identityTables = [
  'credentials',
  'auth_sessions',
  'identity_mail_tokens',
  'identity_email_verifications',
  'identity_mail_requests',
] as const;

describe.skipIf(!TEST_DATABASE_URL)('identity: account deletion on PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  let db: IdentityDatabase;
  let identity: IdentitySlice;
  const servers: FastifyInstance[] = [];

  beforeAll(async () => {
    fixture = await openTestDb();
    db = fixture.db;
  }, 60_000);

  beforeEach(async () => {
    await db.query(
      'truncate accounts, projects, sessions, ledger_entries, billing_wallets cascade',
      [],
    );
  });

  afterEach(async () => {
    for (const server of servers.splice(0)) await server.close();
  });

  afterAll(async () => {
    await fixture?.drop();
  });

  async function server(): Promise<FastifyInstance> {
    identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60 * 60_000,
      loginGate: new LoginGate(),
    });
    const app = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    servers.push(app);
    await app.register(identity.registerRoutes);
    return app;
  }

  async function signup(
    app: FastifyInstance,
    email: string,
  ): Promise<{ accountId: string; cookie: string }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Person Name', password },
    });
    expect(response.statusCode).toBe(201);
    return {
      accountId: response.json<{ accountId: string }>().accountId,
      cookie: response.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value,
    };
  }

  async function signin(app: FastifyInstance, email: string): Promise<number> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email, password },
    });
    return response.statusCode;
  }

  function remove(
    app: FastifyInstance,
    cookie: string,
    payload: object,
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: cookie },
      payload,
    });
  }

  async function me(app: FastifyInstance, cookie: string): Promise<number> {
    return (await app.inject({ url: '/api/me', cookies: { [AUTH_COOKIE]: cookie } })).statusCode;
  }

  /** Mail codes, a verified address and queued mail: everything else identity keeps. */
  async function seedMail(accountId: string, email: string): Promise<void> {
    await db.query(
      `insert into identity_mail_tokens (token_hash, account_id, purpose, email, expires_at)
       values ($1, $2, 'reset', $3, now() + interval '1 hour')`,
      [hex(randomUUID()), accountId, email],
    );
    await db.query('insert into identity_email_verifications (account_id, email) values ($1, $2)', [
      accountId,
      email,
    ]);
    // One request tied to the account, one only to the address.
    await db.query(
      `insert into identity_mail_requests (purpose, email, email_key, account_id)
       values ('verify', $1, $2, $3), ('reset', $1, $2, null)`,
      [email, hex(email), accountId],
    );
  }

  async function snapshot(accountId: string, email: string): Promise<unknown[]> {
    const rows: unknown[] = await db.query(
      'select email, display_name, role, suspended, deleted_at from accounts where id = $1',
      [accountId],
    );
    for (const table of identityTables) {
      rows.push(
        table === 'identity_mail_requests'
          ? await db.query(
              `select count(*)::int as count from ${table} where account_id = $1 or email = $2`,
              [accountId, email],
            )
          : await count(table, accountId),
      );
    }
    return rows;
  }

  async function count(table: string, accountId: string): Promise<number> {
    const rows = await db.query<{ count: number }>(
      `select count(*)::int as count from ${table} where account_id::text = $1`,
      [accountId],
    );
    return rows[0]!.count;
  }

  it('refuses a missing or wrong password and changes nothing', async () => {
    const app = await server();
    const email = 'keep@example.test';
    const { accountId, cookie } = await signup(app, email);
    await seedMail(accountId, email);
    const before = await snapshot(accountId, email);
    for (const payload of [{}, { currentPassword: 'wrong password' }]) {
      const refused = await remove(app, cookie, payload);
      expect(refused.statusCode).toBe(401);
      expect(refused.headers['set-cookie']).toBeUndefined();
    }
    expect(await snapshot(accountId, email)).toEqual(before);
    expect(await me(app, cookie)).toBe(200);
    expect(
      (await app.inject({ method: 'DELETE', url: '/api/me', headers: { origin }, payload: {} }))
        .statusCode,
    ).toBe(401);
  });

  it('tombstones the account, removes what identifies the person, and keeps other slices rows', async () => {
    const app = await server();
    const email = 'gone@example.test';
    const { accountId, cookie } = await signup(app, email);
    await seedMail(accountId, email);
    expect(await signin(app, email)).toBe(200);
    // Other slices' rows name the account; none of them has a foreign key to it.
    await db.query("insert into projects (account_id, title) values ($1, 'Research')", [accountId]);
    await db.query('insert into sessions (id, project_id, account_id) values ($1, $2, $3)', [
      randomUUID(),
      randomUUID(),
      accountId,
    ]);
    await db.query(
      "insert into ledger_entries (account_id, amount, reason) values ($1, 1.25, 'spend')",
      [accountId],
    );
    await db.query('insert into billing_wallets (account_id, cap) values ($1, 5)', [accountId]);
    expect(await count('auth_sessions', accountId)).toBe(2);

    const response = await remove(app, cookie, { currentPassword: password });
    expect(response.statusCode).toBe(204);
    const cleared = response.cookies.find((item) => item.name === AUTH_COOKIE);
    expect(cleared?.value).toBe('');
    expect(cleared?.expires?.getTime()).toBeLessThanOrEqual(Date.now());

    const [row] = await db.query<{
      email: string;
      display_name: string;
      role: string;
      suspended: boolean;
      deleted: boolean;
    }>(
      `select email, display_name, role, suspended, deleted_at is not null as deleted
       from accounts where id = $1`,
      [accountId],
    );
    expect(row).toEqual({
      email: `deleted+${accountId}@invalid`,
      display_name: 'Deleted account',
      role: 'user',
      suspended: true,
      deleted: true,
    });
    for (const table of identityTables) expect(await count(table, accountId)).toBe(0);
    const byAddress = await db.query('select 1 from identity_mail_requests where email = $1', [
      email,
    ]);
    expect(byAddress).toHaveLength(0);
    for (const table of ['projects', 'sessions', 'ledger_entries', 'billing_wallets']) {
      expect(await count(table, accountId)).toBe(1);
    }

    expect(await me(app, cookie)).toBe(401);
    expect(await signin(app, email)).toBe(401);
    expect(await signin(app, `deleted+${accountId}@invalid`)).toBe(401);
    // Deleting again with the old cookie finds no principal.
    expect((await remove(app, cookie, { currentPassword: password })).statusCode).toBe(401);

    // The address is free again, under both unique indexes, as a new account.
    const fresh = await signup(app, ` ${email.toUpperCase()} `);
    expect(fresh.accountId).not.toBe(accountId);
    expect(await me(app, fresh.cookie)).toBe(200);
  });

  it('keeps the tombstone out of staff administration, which can neither see nor revive it', async () => {
    const app = await server();
    const { accountId, cookie } = await signup(app, 'admin-view@example.test');
    expect((await remove(app, cookie, { currentPassword: password })).statusCode).toBe(204);
    expect((await identity.listAccounts()).map((account) => account.id)).not.toContain(accountId);
    expect(await identity.getAccount(accountId)).toBeNull();
    for (const action of [
      () => identity.suspend(accountId, false),
      () => identity.setRole(accountId, 'staff'),
    ]) {
      await expect(action()).rejects.toBeInstanceOf(AdminAccountFailure);
    }
    // Even a direct write cannot unsuspend a tombstone.
    await expect(
      db.query('update accounts set suspended = false where id = $1', [accountId]),
    ).rejects.toMatchObject({ code: '23514' });
    expect(Object.keys(identity).filter((key) => /delet|remov|destroy/i.test(key))).toEqual([]);
  });

  it('lets an account without a password delete only from a sign-in in the last ten minutes', async () => {
    const app = await server();
    const oauth = new OAuthAccounts(db);
    const sessions = new AuthSessions(new PostgresAuthSessionStore(db), {
      lifetimeMs: 60 * 60_000,
    });
    const profile = { subject: 'github-42', email: 'octo@example.test', displayName: 'Octo' };
    const principal = await oauth.resolve('github', profile);
    const stale = await sessions.issue(principal);
    await db.query(
      `update auth_sessions set created_at = now() - interval '11 minutes' where token_hash = $1`,
      [hex(stale.token)],
    );
    const before = await snapshot(principal.accountId, profile.email);
    expect((await remove(app, stale.token, {})).statusCode).toBe(401);
    expect(await snapshot(principal.accountId, profile.email)).toEqual(before);

    const fresh = await sessions.issue(principal);
    // No password exists to prove, so offering one is refused rather than ignored.
    expect((await remove(app, fresh.token, { currentPassword: password })).statusCode).toBe(401);
    expect((await remove(app, fresh.token, {})).statusCode).toBe(204);
    expect(await me(app, stale.token)).toBe(401);
    expect(await count('credentials', principal.accountId)).toBe(0);

    // The provider identity no longer reaches the tombstone: it starts a new account.
    const again = await oauth.resolve('github', profile);
    expect(again.accountId).not.toBe(principal.accountId);
  });

  it('asks an account with both a password and a provider for the password', async () => {
    const app = await server();
    const { accountId, cookie } = await signup(app, 'both@example.test');
    await db.query(
      `insert into credentials (account_id, kind, external_provider, external_id)
       values ($1, 'google', 'google', 'google-7')`,
      [accountId],
    );
    expect((await remove(app, cookie, {})).statusCode).toBe(401);
    expect(await count('credentials', accountId)).toBe(2);
    expect((await remove(app, cookie, { currentPassword: password })).statusCode).toBe(204);
    expect(await count('credentials', accountId)).toBe(0);
  });

  it('is one transaction: a failure part-way leaves nothing half-deleted', async () => {
    const app = await server();
    const email = 'atomic@example.test';
    const { accountId } = await signup(app, email);
    await seedMail(accountId, email);
    const [{ hash } = { hash: '' }] = await db.query<{ hash: string }>(
      "select password_hash as hash from credentials where account_id = $1 and kind = 'password'",
      [accountId],
    );
    const before = await snapshot(accountId, email);
    // Fail after the tombstone update and the credential delete have run.
    const failing: IdentityDatabase = {
      query: (text, values) => db.query(text, values),
      withTransaction: (work) =>
        db.withTransaction((sql) =>
          work({
            query: (text, values) =>
              text.startsWith('delete from auth_sessions')
                ? Promise.reject(new Error('injected failure'))
                : sql.query(text, values),
          }),
        ),
    };
    await expect(
      new PostgresAccountStore(failing).deleteAccount(accountId, {
        kind: 'password',
        expectedHash: hash,
      }),
    ).rejects.toThrow('injected failure');
    expect(await snapshot(accountId, email)).toEqual(before);
    expect(await signin(app, email)).toBe(200);
  });

  it('refuses a proof that went stale under the lock', async () => {
    const app = await server();
    const email = 'stale@example.test';
    const { accountId } = await signup(app, email);
    const before = await snapshot(accountId, email);
    const store = new PostgresAccountStore(db);
    expect(
      await store.deleteAccount(accountId, { kind: 'password', expectedHash: 'superseded' }),
    ).toBe(false);
    expect(
      await store.deleteAccount(accountId, {
        kind: 'recent-session',
        tokenHash: hex('no such session'),
        issuedAfter: 0,
      }),
    ).toBe(false);
    expect(await snapshot(accountId, email)).toEqual(before);
  });
});
