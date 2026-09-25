import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { AuthSessions } from './authSessions.js';
import { createIdentitySlice, type IdentityAuthentication } from './index.js';
import { createSessionSlice } from '../session/index.js';
import type { SessionSnapshot } from '@lumen/contracts';
import type { IdentityDatabase } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { localRoleProbe } from './localRoleProbe.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

// Synthetic eight-character password exercises the accepted minimum over HTTP.
const password = 'testpass';
const origin = 'https://lumen.example';

describe.skipIf(!TEST_DATABASE_URL)('identity: PostgreSQL HTTP and store acceptance', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  let db: IdentityDatabase;
  let accounts: PostgresAccountStore;
  let sessions: PostgresAuthSessionStore;
  const servers: FastifyInstance[] = [];

  beforeAll(async () => {
    fixture = await openTestDb();
    db = fixture.db;
    accounts = new PostgresAccountStore(db);
    sessions = new PostgresAuthSessionStore(db);
  }, 60_000);

  beforeEach(async () => {
    await db.query('truncate accounts cascade', []);
  });

  afterEach(async () => {
    for (const server of servers.splice(0)) await server.close();
  });

  afterAll(async () => {
    await fixture?.drop();
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
      loginGate: new LoginGate({ accountAttempts: 50 }),
    });
    const app = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    servers.push(app);
    await app.register(identity.registerRoutes);
    await app.register(localRoleProbe);
    return app;
  }

  async function registerUser(
    app: FastifyInstance,
    email: string,
  ): Promise<{
    accountId: string;
    cookies: Record<string, string>;
  }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Role test', password },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ role: string }>().role).toBe('user');
    return {
      accountId: response.json<{ accountId: string }>().accountId,
      cookies: {
        [AUTH_COOKIE]: response.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value,
      },
    };
  }

  it('enforces anonymous/member/staff access and rejects client privilege forgery', async () => {
    const app = await server();
    const member = await registerUser(app, 'member@example.test');
    const staff = await registerUser(app, 'staff@example.test');
    await db.query("update accounts set role = 'staff' where id = $1", [staff.accountId]);
    expect((await app.inject({ url: '/api/local/staff-check' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/local/staff-check',
          headers: { authorization: 'stub forged:staff' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/local/staff-check',
          cookies: member.cookies,
          headers: { authorization: `stub ${staff.accountId}:staff` },
        })
      ).statusCode,
    ).toBe(403);
    for (const [email, role] of [
      ['member@example.test', 'user'],
      ['staff@example.test', 'staff'],
    ] as const) {
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      expect(login.json<{ role: string }>().role).toBe(role);
      const cookies = {
        [AUTH_COOKIE]: login.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value,
      };
      expect((await app.inject({ url: '/api/local/staff-check', cookies })).statusCode).toBe(
        role === 'staff' ? 200 : 403,
      );
    }
    const forgedSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email: 'forged@example.test', displayName: 'Forged', password, role: 'staff' },
    });
    expect(forgedSignup.statusCode).toBe(400);
    expect(await accounts.findByEmail('forged@example.test')).toBeNull();
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/me',
          headers: { origin },
          cookies: member.cookies,
          payload: { role: 'staff', accountId: staff.accountId },
        })
      ).statusCode,
    ).toBe(400);
    expect((await accounts.getAccount(member.accountId))?.role).toBe('user');
  }, 30_000);

  it('uses current database roles on existing cookies and blocks suspended logins', async () => {
    const app = await server();
    const user = await registerUser(app, 'changing@example.test');
    const probe = (): Promise<number> =>
      app
        .inject({
          url: '/api/local/staff-check',
          cookies: user.cookies,
        })
        .then((response) => response.statusCode);
    expect(await probe()).toBe(403);
    await db.query("update accounts set role = 'staff' where id = $1", [user.accountId]);
    expect(await probe()).toBe(200);
    await db.query("update accounts set role = 'user' where id = $1", [user.accountId]);
    expect(await probe()).toBe(403);
    const admin = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate(),
    });
    await admin.suspend(user.accountId, true);
    expect(await probe()).toBe(401);
    expect((await app.inject({ url: '/api/me', cookies: user.cookies })).statusCode).toBe(401);
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'changing@example.test', password },
    });
    expect(blocked.statusCode).toBe(401);
    expect(blocked.cookies).toHaveLength(0);
    await expect(
      new AuthSessions(sessions, { lifetimeMs: 60_000 }).issue({
        accountId: user.accountId,
        role: 'user',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    await admin.suspend(user.accountId, false);
    expect((await app.inject({ url: '/api/me', cookies: user.cookies })).statusCode).toBe(401);
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'changing@example.test', password },
    });
    expect(fresh.statusCode).toBe(200);
    const freshCookies = {
      [AUTH_COOKIE]: fresh.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value,
    };
    expect((await app.inject({ url: '/api/me', cookies: freshCookies })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/me', cookies: user.cookies })).statusCode).toBe(401);
  }, 30_000);

  it('wires the public authentication API into the actual session slice without stub credentials', async () => {
    const authentication: IdentityAuthentication = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate({ accountAttempts: 50 }),
    });
    const broker = new Broker();
    const session = createSessionSlice({ broker });
    const app = await buildServer({
      broker,
      resolver: authentication.principalResolver,
      access: session.access,
      logLevel: 'silent',
    });
    servers.push(app);
    await app.register(authentication.registerRoutes);
    await app.register(session.registerRoutes);
    session.registerCommands(broker);
    const owner = await registerUser(app, 'session-owner@example.test');
    const other = await registerUser(app, 'session-other@example.test');
    const me = await app.inject({ url: '/api/me', cookies: owner.cookies });
    expect(me.statusCode).toBe(200);
    expect(me.json<{ id: string }>().id).toBe(owner.accountId);
    expect(await authentication.principalResolver.resolve({ cookies: owner.cookies })).toEqual({
      accountId: owner.accountId,
      role: 'user',
    });
    const opened = await app.inject({
      method: 'POST',
      url: '/api/projects/fixture-project/sessions',
      cookies: owner.cookies,
      headers: { origin },
      payload: { text: 'Real identity integration', accountId: other.accountId, role: 'staff' },
    });
    expect(opened.statusCode).toBe(201);
    const snapshot = opened.json<SessionSnapshot>();
    expect(snapshot.session.accountId).toBe(owner.accountId);
    await session.kernel.idle();
    const sessionPath = `/api/sessions/${snapshot.session.id}`;
    expect((await app.inject({ url: sessionPath, cookies: owner.cookies })).statusCode).toBe(200);
    expect((await app.inject({ url: sessionPath, cookies: other.cookies })).statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${sessionPath}/stop`,
          cookies: other.cookies,
          headers: { origin },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          url: sessionPath,
          headers: { authorization: `stub ${owner.accountId}:staff` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      await session.access.canWatch(
        { accountId: owner.accountId, role: 'user' },
        snapshot.session.id,
      ),
    ).toBe(true);
    expect(
      await session.access.canWatch(
        { accountId: other.accountId, role: 'user' },
        snapshot.session.id,
      ),
    ).toBe(false);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/signout',
          cookies: owner.cookies,
          headers: { origin },
        })
      ).statusCode,
    ).toBe(204);
    expect((await app.inject({ url: sessionPath, cookies: owner.cookies })).statusCode).toBe(401);
    // The real session skeleton still trusts projectId; this is NOT a claim of
    // project ownership validation or a implemented projects slice.
  }, 30_000);

  it('exposes safe admin summaries and live role changes through the public factory', async () => {
    const admin = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate(),
    });
    expect(await admin.listAccounts()).toEqual([]);
    const app = await server();
    const member = await registerUser(app, 'admin-contract@example.test');
    const other = await registerUser(app, 'other-contract@example.test');
    const summary = await admin.getAccount(member.accountId);
    expect(summary).toMatchObject({ id: member.accountId, role: 'user', suspended: false });
    expect(Object.keys(summary!).sort()).toEqual([
      'createdAt',
      'displayName',
      'email',
      'id',
      'role',
      'suspended',
    ]);
    expect(Number.isSafeInteger(summary?.createdAt)).toBe(true);
    await admin.setRole(member.accountId, 'staff');
    await admin.setRole(member.accountId, 'staff');
    expect(
      (await app.inject({ url: '/api/local/staff-check', cookies: member.cookies })).statusCode,
    ).toBe(200);
    expect((await admin.getAccount(other.accountId))?.role).toBe('user');
    await admin.setRole(member.accountId, 'user');
    expect(
      (await app.inject({ url: '/api/local/staff-check', cookies: member.cookies })).statusCode,
    ).toBe(403);
    await admin.suspend(member.accountId, true);
    await admin.setRole(member.accountId, 'staff');
    expect(await admin.getAccount(member.accountId)).toMatchObject({
      suspended: true,
      role: 'staff',
    });
    expect(await accounts.getAccount(member.accountId)).toBeNull();
    const listed = await admin.listAccounts();
    expect(listed).toHaveLength(2);
    expect(listed.find((row) => row.id === member.accountId)?.suspended).toBe(true);
    expect(JSON.stringify(listed)).not.toMatch(/password|token|scrypt/i);
    // A role change never unsuspends an account or restores revoked sessions.
    await admin.suspend(member.accountId, false);
    expect((await app.inject({ url: '/api/me', cookies: member.cookies })).statusCode).toBe(401);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(await admin.getAccount(missing)).toBeNull();
    await expect(admin.setRole(missing, 'staff')).rejects.toMatchObject({
      code: 'account_not_found',
    });
    await expect(admin.suspend(missing, true)).rejects.toMatchObject({ code: 'account_not_found' });
  }, 30_000);

  it('revokes every suspended account session permanently without affecting another account', async () => {
    const user = await signup('suspended@example.test');
    const other = await signup('other@example.test');
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const principal = { accountId: user.id, role: 'user' as const };
    const first = await service.issue(principal);
    const second = await service.issue(principal);
    const unrelated = await service.issue({ accountId: other.id, role: 'user' });
    await accounts.suspend(user.id, true);
    await accounts.suspend(user.id, true);
    expect(await db.query('select id from auth_sessions where account_id = $1', [user.id])).toEqual(
      [],
    );
    await accounts.suspend(user.id, false);
    expect(await service.verify(first.token)).toBeNull();
    expect(await service.verify(second.token)).toBeNull();
    expect(await service.verify(unrelated.token)).not.toBeNull();
  });

  it('rolls back suspension and keeps sessions if revocation fails', async () => {
    const user = await signup();
    const service = new AuthSessions(sessions, { lifetimeMs: 60_000 });
    const issued = await service.issue({ accountId: user.id, role: 'user' });
    // Inject failure at DELETE while retaining the real engine transaction.
    const failing: IdentityDatabase = {
      ...db,
      withTransaction: (work) =>
        db.withTransaction((sql) =>
          work({
            query: <Row extends object>(
              text: string,
              values: readonly unknown[],
            ): Promise<Row[]> => {
              if (text.startsWith('delete from auth_sessions'))
                throw new Error('Injected deletion failure');
              return sql.query<Row>(text, values);
            },
          }),
        ),
    };
    await expect(new PostgresAccountStore(failing).suspend(user.id, true)).rejects.toThrow(
      'Injected deletion failure',
    );
    expect(await service.verify(issued.token)).not.toBeNull();
    expect((await accounts.getPasswordAccount(user.id))?.suspended).toBe(false);
  });

  it('keeps two accounts isolated and revokes every staff session on signout-all', async () => {
    const app = await server();
    const member = await registerUser(app, 'isolated@example.test');
    const staff = await registerUser(app, 'revoke@example.test');
    await db.query("update accounts set role = 'staff' where id = $1", [staff.accountId]);
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'revoke@example.test', password },
    });
    expect(login.statusCode).toBe(200);
    const second = {
      [AUTH_COOKIE]: login.cookies.find((cookie) => cookie.name === AUTH_COOKIE)!.value,
    };
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/me',
          cookies: member.cookies,
          headers: { origin },
          payload: { displayName: 'Member only' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await accounts.getAccount(member.accountId))?.displayName).toBe('Member only');
    expect((await accounts.getAccount(staff.accountId))?.displayName).toBe('Role test');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/signout-all',
          cookies: staff.cookies,
          headers: { origin },
        })
      ).statusCode,
    ).toBe(204);
    for (const cookies of [staff.cookies, second]) {
      expect((await app.inject({ url: '/api/local/staff-check', cookies })).statusCode).toBe(401);
    }
    expect((await app.inject({ url: '/api/me', cookies: member.cookies })).statusCode).toBe(200);
  }, 30_000);

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
