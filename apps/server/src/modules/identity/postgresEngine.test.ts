import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AuthSessions } from './authSessions.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

// Optional external test tool, NOT an application dependency. No connection URL
// or persistent directory is accepted: every run owns a fresh in-memory engine.
// PGlite executes PostgreSQL SQL, but cannot prove multi-connection lock behavior.
const modulePath = process.env['IDENTITY_PGLITE_MODULE'];
interface EngineSql {
  query<Row extends object>(sql: string, values: unknown[]): Promise<{ rows: Row[] }>;
  exec(sql: string): Promise<unknown>;
}
interface Engine extends EngineSql {
  transaction<T>(work: (tx: EngineSql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function sqlPort(engine: EngineSql): IdentitySql {
  return {
    query: async <Row extends object>(sql: string, values: readonly unknown[]): Promise<Row[]> =>
      (await engine.query<Row>(sql, [...values])).rows,
  };
}

const password = 'a sufficiently long test password';
const origin = 'https://lumen.example';

describe.skipIf(!modulePath)('identity: optional PostgreSQL WASM engine acceptance', () => {
  let engine: Engine;
  let db: IdentityDatabase;
  let accounts: PostgresAccountStore;
  let sessions: PostgresAuthSessionStore;
  const servers: FastifyInstance[] = [];

  beforeAll(async () => {
    const loaded = (await import(pathToFileURL(modulePath!).href)) as {
      PGlite: new () => Engine;
    };
    engine = new loaded.PGlite();
    db = {
      ...sqlPort(engine),
      withTransaction: (work) => engine.transaction((tx) => work(sqlPort(tx))),
    };
    accounts = new PostgresAccountStore(db);
    sessions = new PostgresAuthSessionStore(db);
    await engine.exec(await readFile(new URL('../../core/db/schema.sql', import.meta.url), 'utf8'));
    // The real shared runner must own this transaction; this is test setup only.
    await engine.transaction(async (tx) => {
      await tx.exec(
        await readFile(new URL('./migrations/002_identity_auth.sql', import.meta.url), 'utf8'),
      );
    });
  }, 60_000);

  beforeEach(async () => {
    await engine.exec('truncate accounts cascade');
  });

  afterEach(async () => {
    for (const server of servers.splice(0)) await server.close();
  });

  afterAll(async () => {
    await engine?.close();
  });

  function signup(
    email = 'user@example.edu',
  ): ReturnType<PostgresAccountStore['createPasswordAccount']> {
    return accounts.createPasswordAccount({
      email,
      displayName: 'User',
      passwordHash: 'stored-hash',
    });
  }

  async function server(): Promise<FastifyInstance> {
    const identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate({ attempts: 50 }),
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

  it('runs the migration and rejects exact and case-normalized duplicate emails', async () => {
    const created = await signup(' User@Example.edu ');
    expect(created.email).toBe('user@example.edu');
    expect(created.role).toBe('user');
    expect(Number.isSafeInteger(created.createdAt)).toBe(true);
    await expect(signup()).rejects.toMatchObject({ code: 'email_taken' });
    // Test the expression index independently of application normalization.
    await expect(
      db.query("insert into accounts (email, display_name) values ($1, 'Other')", [
        ' USER@EXAMPLE.EDU ',
      ]),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'identity_accounts_email_normalized_key',
    });
    const credentials = await db.query<{ account_id: string; password_hash: string }>(
      'select account_id, password_hash from credentials',
      [],
    );
    expect(credentials).toEqual([{ account_id: created.id, password_hash: 'stored-hash' }]);
  });

  it('really rolls back the account when credential insertion violates a constraint', async () => {
    await expect(
      accounts.createPasswordAccount({
        email: 'rollback@example.edu',
        displayName: 'User',
        passwordHash: '',
      }),
    ).rejects.toMatchObject({ code: '23514' });
    expect(await accounts.findByEmail('rollback@example.edu')).toBeNull();
    expect(await db.query('select id from credentials', [])).toHaveLength(0);
  });

  it('rejects duplicate password credentials and malformed provider credentials', async () => {
    const created = await signup();
    await expect(
      db.query(
        "insert into credentials (account_id, kind, password_hash) values ($1, 'password', 'hash')",
        [created.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query(
        "insert into credentials (account_id, kind, external_id) values ($1, 'github', '123')",
        [created.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('updates profiles and rejects stale password proofs and duplicate emails', async () => {
    const created = await signup();
    await signup('taken@example.edu');
    expect(
      await accounts.updateAccount({
        accountId: created.id,
        patch: { displayName: 'New name' },
      }),
    ).toMatchObject({ displayName: 'New name' });
    expect(await accounts.replacePassword(created.id, 'stored-hash', 'new-hash')).toBe(true);
    expect(await accounts.replacePassword(created.id, 'stored-hash', 'stale-write')).toBe(false);
    expect(
      await accounts.updateAccount({
        accountId: created.id,
        patch: { email: 'new@example.edu' },
        expectedPasswordHash: 'stored-hash',
      }),
    ).toBeNull();
    await expect(
      accounts.updateAccount({
        accountId: created.id,
        patch: { email: 'TAKEN@example.edu' },
        expectedPasswordHash: 'new-hash',
      }),
    ).rejects.toMatchObject({ code: 'email_taken' });
    expect(
      await accounts.updateAccount({
        accountId: created.id,
        patch: { email: ' NEW@Example.edu ' },
        expectedPasswordHash: 'new-hash',
      }),
    ).toMatchObject({ email: 'new@example.edu' });
    expect(await accounts.findByEmail(created.email)).toBeNull();
    expect(await accounts.getPasswordAccount(created.id)).toMatchObject({
      passwordHash: 'new-hash',
    });
  });

  it('persists hashes, joins live account flags and revokes only the target sessions', async () => {
    const created = await signup();
    const other = await signup('other@example.edu');
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const first = await service.issue({ accountId: created.id, role: 'user' });
    const second = await service.issue({ accountId: created.id, role: 'user' });
    const unrelated = await service.issue({ accountId: other.id, role: 'user' });
    const stored = await db.query<{ token_hash: string }>(
      'select token_hash from auth_sessions',
      [],
    );
    expect(stored.every((row) => /^[a-f0-9]{64}$/.test(row.token_hash))).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(first.token);
    await db.query("update accounts set role = 'staff' where id = $1", [created.id]);
    expect(await service.verify(first.token)).toEqual({ accountId: created.id, role: 'staff' });
    await db.query('update accounts set suspended = true where id = $1', [created.id]);
    expect(await service.verify(first.token)).toBeNull();
    expect(await accounts.getAccount(created.id)).toBeNull();
    expect(await accounts.replacePassword(created.id, 'stored-hash', 'new-hash')).toBe(false);
    expect(
      await accounts.updateAccount({ accountId: created.id, patch: { displayName: 'No' } }),
    ).toBeNull();
    await db.query('update accounts set suspended = false where id = $1', [created.id]);
    await service.revoke(first.token);
    expect(await service.verify(first.token)).toBeNull();
    expect(await service.verify(second.token)).not.toBeNull();
    await service.revokeAll(created.id);
    expect(await service.verify(second.token)).toBeNull();
    expect(await service.verify(unrelated.token)).not.toBeNull();
  });

  it('round-trips millisecond expiry and rejects malformed/duplicate tokens at storage', async () => {
    const created = await signup();
    const session = {
      accountId: created.id,
      tokenHash: 'a'.repeat(64),
      createdAt: 1001,
      expiresAt: 2002,
    };
    await sessions.insert(session);
    expect(await sessions.findByTokenHash(session.tokenHash)).toMatchObject({ expiresAt: 2002 });
    const service = new AuthSessions(sessions, { lifetimeMs: 1, now: () => 2002 });
    // This assertion uses a freshly issued real token to check the exact boundary.
    let now = 1001;
    const clocked = new AuthSessions(sessions, { lifetimeMs: 1001, now: () => now });
    const issued = await clocked.issue({ accountId: created.id, role: 'user' });
    now = 2002;
    expect(await clocked.verify(issued.token)).toBeNull();
    expect(await service.verify(issued.token)).toBeNull();
    await expect(sessions.insert(session)).rejects.toMatchObject({ code: '23505' });
    await expect(sessions.insert({ ...session, tokenHash: 'plaintext' })).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      sessions.insert({ ...session, tokenHash: 'b'.repeat(64), expiresAt: 1001 }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('walks real SQL signup/login/account/password/signout across fresh app instances', async () => {
    let app = await server();
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email: 'user@example.edu', displayName: 'User', password },
    });
    expect(registered.statusCode).toBe(201);
    const cookie = registered.cookies.find((item) => item.name === AUTH_COOKIE)!;
    const cookies = { [AUTH_COOKIE]: cookie.value };
    const profile = await app.inject({ url: '/api/me', cookies });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ email: 'user@example.edu' });
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: { origin },
      cookies,
      payload: { email: 'new@example.edu', currentPassword: password },
    });
    expect(changed.statusCode).toBe(200);
    const nextPassword = 'a different sufficiently long password';
    const changePassword = await app.inject({
      method: 'POST',
      url: '/api/me/password',
      headers: { origin },
      cookies,
      payload: { currentPassword: password, newPassword: nextPassword },
    });
    expect(changePassword.statusCode).toBe(204);
    await app.close();
    servers.splice(servers.indexOf(app), 1);
    // New slice and server, same engine: no process-local auth store can help.
    app = await server();
    expect((await app.inject({ url: '/api/me', cookies })).statusCode).toBe(200);
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'new@example.edu', password },
    });
    expect(oldLogin.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'new@example.edu', password: nextPassword },
    });
    expect(login.statusCode).toBe(200);
    const loginCookie = {
      [AUTH_COOKIE]: login.cookies.find((item) => item.name === AUTH_COOKIE)!.value,
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/signout',
          headers: { origin },
          cookies,
        })
      ).statusCode,
    ).toBe(204);
    expect((await app.inject({ url: '/api/me', cookies })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/me', cookies: loginCookie })).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/signout-all',
          headers: { origin },
          cookies: loginCookie,
        })
      ).statusCode,
    ).toBe(204);
    expect((await app.inject({ url: '/api/me', cookies: loginCookie })).statusCode).toBe(401);
  }, 30_000);
});
