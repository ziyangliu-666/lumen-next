import { readFile } from 'node:fs/promises';
import { readLocalBaseSchema } from './localSchema.js';
import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import {
  createIdentitySlice,
  LoginGate,
  OAuthAccounts,
  OAuthAttempts,
  AuthSessions,
  PasswordStrategy,
  PostgresAccountStore,
  PostgresAuthSessionStore,
  SessionAuthFlow,
  type OAuthKind,
} from './index.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type { IdentityMail } from './mail.js';
import { verifyPassword } from './passwordHash.js';

interface EngineSql {
  query<Row extends object>(text: string, values: unknown[]): Promise<{ rows: Row[] }>;
  exec(text: string): Promise<unknown>;
}
interface Engine extends EngineSql {
  transaction<T>(work: (tx: EngineSql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
function port(engine: EngineSql): IdentitySql {
  return {
    query: async <Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]> =>
      (await engine.query<Row>(text, [...values])).rows,
  };
}
const modulePath = process.env['IDENTITY_PGLITE_MODULE'];
const origin = 'https://lumen.example';

describe.skipIf(!modulePath)('identity: OAuth and mail SQL/HTTP workflows', () => {
  let engine: Engine;
  let db: IdentityDatabase;
  let app: FastifyInstance;
  const sent: IdentityMail[] = [];
  const mailSender = {
    send: vi.fn((message: IdentityMail) => {
      sent.push(message);
      return Promise.resolve();
    }),
  };
  const deliveryFailed = vi.fn();
  const profile = vi.fn((kind: OAuthKind) =>
    Promise.resolve({
      subject: `${kind}-subject`,
      email: `${kind}@example.test`,
      displayName: 'Provider User',
    }),
  );
  beforeAll(async () => {
    const library = (await import(pathToFileURL(modulePath!).href)) as { PGlite: new () => Engine };
    engine = new library.PGlite();
    db = { ...port(engine), withTransaction: (work) => engine.transaction((tx) => work(port(tx))) };
    await engine.exec(await readLocalBaseSchema());
    for (const migration of [
      '002_identity_auth.sql',
      '003_identity_oauth.sql',
      '004_identity_mail.sql',
    ]) {
      const sql = await readFile(new URL(`./migrations/${migration}`, import.meta.url), 'utf8');
      await engine.transaction((tx) => tx.exec(sql));
    }
  }, 60_000);
  beforeEach(async () => {
    await engine.exec('truncate accounts cascade; truncate identity_oauth_attempts');
    profile.mockClear();
    sent.length = 0;
    mailSender.send.mockClear();
    deliveryFailed.mockClear();
    const identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60_000,
      loginGate: new LoginGate({ attempts: 50 }),
      mailSender,
      mailDeliveryFailed: deliveryFailed,
      oauthProviders: (['github', 'google'] as const).map((kind) => ({
        kind,
        authorizationURL(state: string, verifier: string): URL {
          const url = new URL(`https://${kind}.example/authorize`);
          url.searchParams.set('state', state);
          expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
          return url;
        },
        profile: () => profile(kind),
      })),
    });
    app = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(identity.registerRoutes);
  });
  afterEach(async () => {
    await app?.close();
  });
  afterAll(async () => {
    await engine?.close();
  });

  async function begin(
    kind: OAuthKind,
  ): Promise<{ state: string; cookies: Record<string, string> }> {
    const response = await app.inject({ url: `/api/auth/${kind}` });
    expect(response.statusCode).toBe(302);
    expect(response.headers['cache-control']).toBe('no-store');
    const binding = response.cookies.find((cookie) => cookie.name === `lumen_oauth_${kind}`)!;
    expect(binding).toMatchObject({
      httpOnly: true,
      secure: true,
      path: `/api/auth/${kind}/callback`,
    });
    return {
      state: new URL(response.headers.location!).searchParams.get('state')!,
      cookies: { [binding.name]: binding.value },
    };
  }
  async function complete(
    kind: OAuthKind,
  ): Promise<{ accountId: string; cookies: Record<string, string> }> {
    const attempt = await begin(kind);
    const response = await app.inject({
      url: `/api/auth/${kind}/callback?state=${attempt.state}&code=provider-code`,
      cookies: attempt.cookies,
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/#/home');
    const cookie = response.cookies.find((item) => item.name === 'lumen_session')!;
    expect(cookie).toMatchObject({ httpOnly: true, secure: true });
    const cookies = { [cookie.name]: cookie.value };
    const me = await app.inject({ url: '/api/me', cookies });
    expect(me.statusCode).toBe(200);
    return { accountId: me.json<{ id: string }>().id, cookies };
  }

  async function passwordUser(
    email = 'mail@example.test',
  ): Promise<{ accountId: string; cookies: Record<string, string> }> {
    const result = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Mail User', password: 'original mail test password' },
    });
    expect(result.statusCode).toBe(201);
    const cookie = result.cookies.find((entry) => entry.name === 'lumen_session')!;
    return {
      accountId: result.json<{ accountId: string }>().accountId,
      cookies: { [cookie.name]: cookie.value },
    };
  }
  function deliveredCode(): string {
    const match = sent.at(-1)?.text.match(/\n([A-Za-z0-9_-]{43})\n/);
    expect(match).not.toBeNull();
    return match![1]!;
  }
  async function forgot(email: string): Promise<void> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      headers: { origin },
      payload: { email },
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).not.toMatch(/token|code=/);
  }

  it('verifies only the signed-in account email with a purpose-bound single-use code', async () => {
    const user = await passwordUser();
    const other = await passwordUser('other-mail@example.test');
    expect(
      (await app.inject({ url: '/api/me/email-status', cookies: user.cookies })).json(),
    ).toEqual({ verified: false });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/me/email/verification',
          headers: { origin },
          cookies: user.cookies,
        })
      ).statusCode,
    ).toBe(202);
    const code = deliveredCode();
    expect(sent[0]?.to).toBe('mail@example.test');
    expect(
      JSON.stringify(await db.query('select token_hash from identity_mail_tokens', [])),
    ).not.toContain(code);
    const confirm = async (cookies: Record<string, string>): Promise<{ statusCode: number }> =>
      app.inject({
        method: 'POST',
        url: '/api/me/email/verify',
        headers: { origin },
        cookies,
        payload: { code },
      });
    expect((await confirm(other.cookies)).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          headers: { origin },
          payload: { code, newPassword: 'a replacement mail password' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await confirm(user.cookies)).statusCode).toBe(204);
    expect((await confirm(user.cookies)).statusCode).toBe(400);
    expect(
      (await app.inject({ url: '/api/me/email-status', cookies: user.cookies })).json(),
    ).toEqual({ verified: true });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/me',
          headers: { origin },
          cookies: user.cookies,
          payload: {
            email: 'changed@example.test',
            currentPassword: 'original mail test password',
          },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: '/api/me/email-status', cookies: user.cookies })).json(),
    ).toEqual({ verified: false });
  }, 30_000);

  it('resets a password once, revokes existing sessions and requires a new login', async () => {
    const user = await passwordUser();
    await forgot('mail@example.test');
    const code = deliveredCode();
    const body = { code, newPassword: 'newpass8' };
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { origin },
      payload: body,
    });
    expect(reset.statusCode).toBe(204);
    expect(reset.cookies).toHaveLength(0);
    expect((await app.inject({ url: '/api/me', cookies: user.cookies })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/reset-password',
          headers: { origin },
          payload: body,
        })
      ).statusCode,
    ).toBe(400);
    for (const [password, status] of [
      ['original mail test password', 401],
      ['newpass8', 200],
    ] as const) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/auth/password',
            headers: { origin },
            payload: { email: 'mail@example.test', password },
          })
        ).statusCode,
      ).toBe(status);
    }
  }, 30_000);

  it('rejects stale password proof when reset commits before login session issuance', async () => {
    const user = await passwordUser();
    await forgot('mail@example.test');
    const code = deliveredCode();
    const strategy = new PasswordStrategy(new PostgresAccountStore(db), async (password, hash) => {
      const valid = await verifyPassword(password, hash);
      // Deterministic interleaving: verification finishes, then reset commits,
      // then the login flow tries to persist its session using the stale proof.
      const reset = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { origin },
        payload: { code, newPassword: 'reset wins before session issuance' },
      });
      expect(reset.statusCode).toBe(204);
      return valid;
    });
    const flow = new SessionAuthFlow(
      [strategy],
      new AuthSessions(new PostgresAuthSessionStore(db), {
        lifetimeMs: 60_000,
      }),
    );
    await expect(
      flow.authenticate('password', {
        email: 'mail@example.test',
        password: 'original mail test password',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(
      await db.query('select id from auth_sessions where account_id = $1', [user.accountId]),
    ).toHaveLength(0);
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { origin },
      payload: { email: 'mail@example.test', password: 'reset wins before session issuance' },
    });
    expect(fresh.statusCode).toBe(200);
    expect(Object.keys(fresh.json<object>()).sort()).toEqual(['accountId', 'role']);
  }, 30_000);

  it('returns the same forgot-password response for unknown, provider-only and suspended accounts', async () => {
    const user = await passwordUser();
    await complete('google');
    await db.query('update accounts set suspended = true where id = $1', [user.accountId]);
    for (const email of ['unknown@example.test', 'google@example.test', 'mail@example.test'])
      await forgot(email);
    expect(sent).toHaveLength(0);
    expect(await db.query('select token_hash from identity_mail_tokens', [])).toHaveLength(0);
  }, 30_000);

  it('expires/replaces reset codes and invalidates a code after a password change', async () => {
    const user = await passwordUser();
    await forgot('mail@example.test');
    const old = deliveredCode();
    await forgot('mail@example.test');
    const fresh = deliveredCode();
    const reset = async (code: string): Promise<{ statusCode: number }> =>
      app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: { origin },
        payload: { code, newPassword: 'another secure test password' },
      });
    expect((await reset(old)).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/me/password',
          headers: { origin },
          cookies: user.cookies,
          payload: {
            currentPassword: 'original mail test password',
            newPassword: 'changed through account settings',
          },
        })
      ).statusCode,
    ).toBe(204);
    expect((await reset(fresh)).statusCode).toBe(400);
    await forgot('mail@example.test');
    const expired = deliveredCode();
    await db.query("update identity_mail_tokens set expires_at = now() - interval '1 second'", []);
    expect((await reset(expired)).statusCode).toBe(400);
  }, 30_000);

  it('does not disclose delivery failures in forgot responses and rejects untrusted mutation origins', async () => {
    await passwordUser();
    mailSender.send.mockRejectedValueOnce(new Error('private provider failure'));
    await forgot('mail@example.test');
    expect(deliveryFailed).toHaveBeenCalledOnce();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/forgot-password',
          headers: { origin: 'https://evil.example' },
          payload: { email: 'mail@example.test' },
        })
      ).statusCode,
    ).toBe(403);
  }, 30_000);

  it('keeps forgot responses generic even when delivery failure telemetry throws', async () => {
    await passwordUser();
    mailSender.send.mockRejectedValueOnce(new Error('private provider failure'));
    deliveryFailed.mockImplementationOnce(() => {
      throw new Error('private telemetry failure');
    });
    await forgot('mail@example.test');
    expect(deliveryFailed).toHaveBeenCalledOnce();
    expect(deliveryFailed).toHaveBeenCalledWith();
    // A failed transport must not prevent a later replacement request.
    await forgot('mail@example.test');
    expect(sent).toHaveLength(1);
  }, 30_000);

  it('replaces verification proofs and rejects expired proofs without changing status', async () => {
    const user = await passwordUser();
    const request = async (): Promise<string> => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/me/email/verification',
        headers: { origin },
        cookies: user.cookies,
      });
      expect(response.statusCode).toBe(202);
      return deliveredCode();
    };
    const confirm = async (code: string): Promise<number> =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/me/email/verify',
          headers: { origin },
          cookies: user.cookies,
          payload: { code },
        })
      ).statusCode;
    const old = await request();
    const replacement = await request();
    expect(replacement).not.toBe(old);
    expect(await confirm(old)).toBe(400);
    await db.query("update identity_mail_tokens set expires_at = now() - interval '1 second'", []);
    expect(await confirm(replacement)).toBe(400);
    expect(
      (await app.inject({ url: '/api/me/email-status', cookies: user.cookies })).json(),
    ).toEqual({ verified: false });
    expect(await confirm(await request())).toBe(204);
    expect(
      (await app.inject({ url: '/api/me/email-status', cookies: user.cookies })).json(),
    ).toEqual({ verified: true });
  }, 30_000);

  it.each(['github', 'google'] as const)(
    'creates a user through %s and signs in again without duplicating accounts',
    async (kind) => {
      expect((await app.inject({ url: '/api/auth/providers' })).json()).toEqual({
        github: true,
        google: true,
      });
      const first = await complete(kind);
      const second = await complete(kind);
      expect(second.accountId).toBe(first.accountId);
      expect(await db.query('select id from accounts', [])).toHaveLength(1);
      expect(
        await db.query('select id from credentials where kind = $1 and password_hash is null', [
          kind,
        ]),
      ).toHaveLength(1);
      expect(await db.query('select state_hash from identity_oauth_attempts', [])).toHaveLength(0);
    },
  );

  it('requires matching browser cookie and provider; callbacks are one-use', async () => {
    const attempt = await begin('google');
    const url = `/api/auth/google/callback?state=${attempt.state}&code=code`;
    expect((await app.inject({ url })).headers.location).toContain('oauth_failed');
    expect(
      (
        await app.inject({
          url: `/api/auth/github/callback?state=${attempt.state}&code=code`,
          cookies: { lumen_oauth_github: attempt.cookies['lumen_oauth_google']! },
        })
      ).headers.location,
    ).toContain('oauth_failed');
    expect(profile).not.toHaveBeenCalled();
    expect((await app.inject({ url, cookies: attempt.cookies })).headers.location).toBe('/#/home');
    expect((await app.inject({ url, cookies: attempt.cookies })).headers.location).toContain(
      'oauth_failed',
    );
    expect(profile).toHaveBeenCalledTimes(1);
  });

  it('rejects expired state and consumes cancelled authorization without creating a session', async () => {
    const expired = await begin('github');
    await db.query(
      "update identity_oauth_attempts set expires_at = now() - interval '1 second'",
      [],
    );
    expect(
      (
        await app.inject({
          url: `/api/auth/github/callback?state=${expired.state}&code=code`,
          cookies: expired.cookies,
        })
      ).headers.location,
    ).toContain('oauth_failed');
    const cancelled = await begin('google');
    expect(
      (
        await app.inject({
          url: `/api/auth/google/callback?state=${cancelled.state}&error=access_denied`,
          cookies: cancelled.cookies,
        })
      ).headers.location,
    ).toContain('oauth_failed');
    expect(profile).not.toHaveBeenCalled();
    expect(await db.query('select id from auth_sessions', [])).toHaveLength(0);
  });

  it('never automatically links an existing email or creates a second provider credential on it', async () => {
    await db.query(
      "insert into accounts (email, display_name) values ('github@example.test', 'Password User')",
      [],
    );
    const attempt = await begin('github');
    const response = await app.inject({
      url: `/api/auth/github/callback?state=${attempt.state}&code=code`,
      cookies: attempt.cookies,
    });
    expect(response.headers.location).toContain('oauth_email_conflict');
    expect(response.cookies.some((cookie) => cookie.name === 'lumen_session')).toBe(false);
    expect(await db.query('select id from credentials', [])).toHaveLength(0);
  });

  it('uses current staff role and rejects suspended provider accounts', async () => {
    const user = await complete('google');
    await db.query("update accounts set role = 'staff' where id = $1", [user.accountId]);
    const staff = await begin('google');
    expect(
      (
        await app.inject({
          url: `/api/auth/google/callback?state=${staff.state}&code=code`,
          cookies: staff.cookies,
        })
      ).headers.location,
    ).toBe('/#/admin');
    await db.query('update accounts set suspended = true where id = $1', [user.accountId]);
    const suspended = await begin('google');
    const response = await app.inject({
      url: `/api/auth/google/callback?state=${suspended.state}&code=code`,
      cookies: suspended.cookies,
    });
    expect(response.headers.location).toContain('oauth_failed');
    expect(response.cookies.some((cookie) => cookie.name === 'lumen_session')).toBe(false);
  });

  it('stores hashed state/binding and enforces strict state/profile input', async () => {
    const attempts = new OAuthAttempts(db);
    const attempt = await attempts.begin('github');
    const rows = await db.query<{ state_hash: string; binding_hash: string }>(
      'select state_hash, binding_hash from identity_oauth_attempts',
      [],
    );
    expect(rows[0]?.state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(attempt.state);
    expect(JSON.stringify(rows)).not.toContain(attempt.binding);
    await expect(attempts.consume('github', ['bad'], attempt.binding)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(
      new OAuthAccounts(db).resolve('google', {
        subject: '',
        email: 'invalid',
        displayName: 'Name',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });
});
