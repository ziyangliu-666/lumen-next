import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createIdentitySlice, type IdentitySlice } from './createIdentitySlice.js';
import { LoginGate } from './loginGate.js';
import { OAuthAccounts, OAuthAttempts, type OAuthProvider } from './oauth.js';
import { KeyRemoval } from './keyRemoval.js';
import { PostgresAccountStore } from './postgresStores.js';
import { hashPassword } from './passwordHash.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

const origin = 'https://lumen.example';
const password = 'synthetic-password';
const email = 'removal@example.test';

describe.skipIf(!TEST_DATABASE_URL)('identity: restricted OpenAI key removal', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let app: FastifyInstance;
  let identity: IdentitySlice;
  let id: string;
  let failCleanup: boolean;
  let subject: string;
  let providerCalls: number;
  const provider: OAuthProvider = {
    kind: 'github',
    authorizationURL: (state, verifier) =>
      new URL(`https://github.example/authorize?state=${state}&challenge=${verifier.length}`),
    profile: () => {
      providerCalls += 1;
      return Promise.resolve({ subject, email, displayName: 'Fixture' });
    },
  };
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    subject = 'existing-subject';
    providerCalls = 0;
    failCleanup = false;
    await db.query('create table identity_key_removal_fixture (account_id uuid primary key)');
    identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate(),
      oauthProviders: [provider],
      removeOwnOpenAiKey: async (owner, tx) => {
        await tx.query('delete from identity_key_removal_fixture where account_id = $1', [owner]);
        if (failCleanup) throw new Error('cleanup unavailable');
      },
    });
    app = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(identity.registerRoutes);
    const store = new PostgresAccountStore(db);
    id = (
      await store.createPasswordAccount({
        email,
        displayName: 'Fixture',
        passwordHash: await hashPassword(password),
      })
    ).id;
    await db.query('insert into identity_key_removal_fixture values ($1)', [id]);
  });
  afterEach(async () => {
    await app.close();
    await drop();
  });
  const remove = (
    body: unknown = { email, password },
    requestOrigin = origin,
  ): Promise<LightMyRequestResponse> =>
    app.inject({
      method: 'POST',
      url: '/api/auth/key-removal/openai/password',
      headers: { origin: requestOrigin },
      payload: body as object,
    });
  async function keys(owner = id): Promise<number> {
    return (
      await db.query('select 1 from identity_key_removal_fixture where account_id = $1', [owner])
    ).length;
  }
  async function linked(): Promise<void> {
    await db.query(
      `insert into credentials (account_id, kind, external_provider, external_id) values ($1, 'github', 'github', $2)`,
      [id, subject],
    );
    await identity.suspend(id, true);
  }
  async function begin(): Promise<{ state: string; cookie: string }> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/key-removal/openai/github',
      headers: { origin },
      payload: { confirm: 'remove-openai-key' },
    });
    expect(response.statusCode).toBe(303);
    const state = new URL(response.headers.location!).searchParams.get('state')!;
    return {
      state,
      cookie: `lumen_key_removal_github=${response.cookies.find((c) => c.name === 'lumen_key_removal_github')!.value}`,
    };
  }
  const callback = (attempt: { state: string; cookie: string }): Promise<LightMyRequestResponse> =>
    app.inject({
      method: 'GET',
      url: `/api/auth/github/callback?state=${attempt.state}&code=synthetic-code`,
      headers: { cookie: attempt.cookie },
    });

  it('allows fresh password proof for a suspended owner without minting a session or reviving an old one', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email, password },
    });
    const cookie = `${AUTH_COOKIE}=${login.cookies.find((c) => c.name === AUTH_COOKIE)!.value}`;
    await identity.suspend(id, true);
    const response = await remove();
    expect(response.statusCode).toBe(204);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.cookies.some((c) => c.name === AUTH_COOKIE)).toBe(false);
    expect(await keys()).toBe(0);
    expect((await identity.getAccount(id))?.suspended).toBe(true);
    expect(await db.query('select 1 from auth_sessions where account_id = $1', [id])).toEqual([]);
    expect((await app.inject({ url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/password',
          headers: { origin },
          payload: { email, password },
        })
      ).statusCode,
    ).toBe(401);
    expect((await remove()).statusCode).toBe(204);
  });

  it('ignores no owner override and refuses wrong proof, foreign Origin and unknown/deleted accounts', async () => {
    expect((await remove({ email, password, accountId: randomUUID() })).statusCode).toBe(401);
    expect((await remove({ email, password: 'wrong' })).statusCode).toBe(401);
    expect((await remove({ email: 'unknown@example.test', password })).statusCode).toBe(401);
    expect((await remove({ email, password }, 'https://evil.example')).statusCode).toBe(403);
    expect(await keys()).toBe(1);
    const store = new PostgresAccountStore(db);
    const hash = (await store.getPasswordAccount(id))!.passwordHash!;
    await store.deleteAccount(id, { kind: 'password', expectedHash: hash });
    expect((await remove()).statusCode).toBe(401);
    expect(await keys()).toBe(1);
  });

  it('bounds repeated password failures', async () => {
    for (let n = 0; n < 5; n += 1)
      expect((await remove({ email, password: 'wrong' })).statusCode).toBe(401);
    expect((await remove()).statusCode).toBe(429);
    expect(await keys()).toBe(1);
  });

  it('rolls back failed removal and leaves another owner untouched', async () => {
    const other = randomUUID();
    await db.query('insert into identity_key_removal_fixture values ($1)', [other]);
    failCleanup = true;
    expect((await remove()).statusCode).toBe(500);
    expect(await keys()).toBe(1);
    failCleanup = false;
    expect((await remove()).statusCode).toBe(204);
    expect(await keys(other)).toBe(1);
  });

  it('uses fresh purpose-bound OAuth proof for an OAuth-only suspended account; never issues login authority', async () => {
    await linked();
    await db.query("delete from credentials where account_id = $1 and kind = 'password'", [id]);
    const attempt = await begin();
    const response = await callback(attempt);
    expect(response.headers.location).toBe('/?keyRemoval=complete#/signin');
    expect(response.cookies.some((c) => c.name === AUTH_COOKIE)).toBe(false);
    expect(await keys()).toBe(0);
    expect(await db.query('select 1 from auth_sessions where account_id = $1', [id])).toEqual([]);
    expect((await identity.getAccount(id))?.suspended).toBe(true);
    expect((await callback(attempt)).headers.location).toBe('/?keyRemoval=failed#/signin');
    expect(providerCalls).toBe(1);
  });

  it('requires explicit same-Origin OAuth initiation', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/key-removal/openai/github',
          payload: { confirm: 'remove-openai-key' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/key-removal/openai/github',
          headers: { origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
    expect(await keys()).toBe(1);
  });

  it('does not exchange mismatched/expired attempts or use sign-in state for deletion', async () => {
    await linked();
    const attempt = await begin();
    expect(
      (await callback({ ...attempt, cookie: 'lumen_key_removal_github=wrong' })).headers.location,
    ).toBe('/?keyRemoval=failed#/signin');
    await db.query("update identity_oauth_attempts set expires_at = now() - interval '1 second'");
    expect((await callback(attempt)).headers.location).toBe('/?keyRemoval=failed#/signin');
    const signin = await new OAuthAttempts(db).begin('github');
    expect(
      (
        await callback({
          state: `kr_${signin.state}`,
          cookie: `lumen_key_removal_github=${signin.binding}`,
        })
      ).headers.location,
    ).toBe('/?keyRemoval=failed#/signin');
    expect(providerCalls).toBe(0);
    expect(await keys()).toBe(1);
  });

  it('never creates or email-links an unknown OAuth subject', async () => {
    await linked();
    subject = 'unknown-subject';
    expect((await callback(await begin())).headers.location).toBe('/?keyRemoval=failed#/signin');
    expect(await keys()).toBe(1);
    expect(await db.query('select 1 from accounts')).toHaveLength(1);
  });

  it('cannot redeem removal state through the normal login flow', async () => {
    await linked();
    const attempt = await begin();
    const result = await app.inject({
      url: `/api/auth/github/callback?state=${attempt.state.slice(3)}&code=synthetic-code`,
      headers: { cookie: attempt.cookie.replace('lumen_key_removal_', 'lumen_oauth_') },
    });
    expect(result.headers.location).toBe('/?authError=oauth_failed#/signin');
    expect(providerCalls).toBe(0);
    expect(await keys()).toBe(1);
  });

  it('refuses OAuth subject rebinding before the under-lock proof check', async () => {
    await linked();
    const service = new KeyRemoval(
      {
        query: (text, values) => db.query(text, values),
        withTransaction: async (work) => {
          await db.query("delete from credentials where account_id = $1 and kind = 'github'", [id]);
          return db.withTransaction(work);
        },
      },
      async (owner, tx) => {
        await tx.query('delete from identity_key_removal_fixture where account_id = $1', [owner]);
      },
    );
    await expect(
      service.oauth('github', { subject, email, displayName: '' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(await keys()).toBe(1);
    // Ordinary OAuth remains independent: it refuses a suspended account.
    await expect(
      new OAuthAccounts(db).resolve('github', { subject: 'new', email, displayName: '' }),
    ).rejects.toThrow();
  });

  it('rejects a password changed after verification but before the account lock', async () => {
    const service = new KeyRemoval(
      {
        query: (text, values) => db.query(text, values),
        withTransaction: async (work) => {
          await db.query(
            "update credentials set password_hash = 'changed-version' where account_id = $1 and kind = 'password'",
            [id],
          );
          return db.withTransaction(work);
        },
      },
      async (owner, tx) => {
        await tx.query('delete from identity_key_removal_fixture where account_id = $1', [owner]);
      },
    );
    await expect(service.password({ email, password })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(await keys()).toBe(1);
  });
});
