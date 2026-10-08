import type { LightMyRequestResponse } from 'fastify';
import { randomBytes } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { composeApp, type App } from './app.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';
import { secretCipherFromEnvironment } from './modules/billing/index.js';
import { createIdentitySlice, LoginGate } from './modules/identity/index.js';
import { nullModel } from './core/model/index.js';

const origin = 'http://localhost:4000';
const password = 'correct horse battery 9';
const cipher = secretCipherFromEnvironment({
  BILLING_SECRET_KEYRING: JSON.stringify({ fixture: randomBytes(32).toString('base64') }),
  BILLING_SECRET_ACTIVE_KEY_ID: 'fixture',
})!;
let app: App | undefined;
let drop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await app?.session.kernel.idle();
  await app?.server.close();
  await drop?.();
});

it('refuses configured Keys without the real account lifecycle', async () => {
  await expect(composeApp({ db: null, identity: null, secretCipher: cipher })).rejects.toThrow(
    'Keys require real identity',
  );
});

it.skipIf(!TEST_DATABASE_URL).each([false, true])(
  'composes Keys storage, model selection and removal (steering=%s)',
  async (useSteeringWorker) => {
    const opened = await openTestDb();
    drop = opened.drop;
    const db = opened.db;
    const fallback = vi.fn<typeof nullModel.complete>((request, signal) =>
      nullModel.complete(request, signal),
    );
    const keys: string[] = [];
    const options = {
      db,
      useSteeringWorker,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      logLevel: 'silent',
      secretCipher: cipher,
      model: { ...nullModel, complete: fallback },
      openaiWithKey: (key: string) => {
        keys.push(key);
        return nullModel;
      },
    };
    app = await composeApp(options);
    const signup = async (email: string): Promise<{ id: string; cookie: string }> => {
      const response = await app!.server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin },
        payload: { email, password, displayName: 'Key fixture' },
      });
      expect(response.statusCode).toBe(201);
      return {
        id: response.json<{ accountId: string }>().accountId,
        cookie: response.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
      };
    };
    const one = await signup('keys-one@example.test');
    const two = await signup('keys-two@example.test');
    const put = (
      cookie: string,
      payload: object,
      requestOrigin = origin,
    ): Promise<LightMyRequestResponse> =>
      app!.server.inject({
        method: 'PUT',
        url: '/api/keys/openai',
        headers: { cookie, origin: requestOrigin },
        payload,
      });
    expect((await app.server.inject({ url: '/api/keys' })).statusCode).toBe(401);
    expect(
      (await put(one.cookie, { value: 'synthetic-first', accountId: two.id })).statusCode,
    ).toBe(400);
    expect((await put(one.cookie, { value: '' })).statusCode).toBe(400);
    expect((await put(one.cookie, { value: 'x'.repeat(22000) })).statusCode).toBe(413);
    expect(
      (await put(one.cookie, { value: 'synthetic-first' }, 'https://foreign.example')).statusCode,
    ).toBe(403);
    expect((await put(one.cookie, { value: 'synthetic-first' })).statusCode).toBe(204);
    expect(JSON.stringify(await db.query('select * from billing_secrets'))).not.toContain(
      'synthetic-first',
    );
    const meta = await app.server.inject({ url: '/api/keys', headers: { cookie: one.cookie } });
    expect(meta.headers['cache-control']).toBe('no-store');
    expect(meta.json()).toEqual({
      keys: [
        {
          provider: 'openai',
          updatedAt: meta.json<{ keys: { updatedAt: string }[] }>().keys[0]!.updatedAt,
        },
      ],
    });
    expect(
      (await app.server.inject({ url: '/api/keys', headers: { cookie: two.cookie } })).json(),
    ).toEqual({ keys: [] });
    expect(
      (
        await app.server.inject({
          method: 'DELETE',
          url: '/api/keys/openai',
          headers: { cookie: two.cookie, origin },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await app.server.inject({
          method: 'DELETE',
          url: '/api/keys/openai',
          headers: { cookie: one.cookie, origin: 'https://foreign.example' },
        })
      ).statusCode,
    ).toBe(403);
    await app.server.close();
    app = await composeApp(options);
    expect(
      (await app.server.inject({ url: '/api/keys', headers: { cookie: one.cookie } })).json(),
    ).toEqual(meta.json());
    const ask = async (accountId: string): Promise<void> => {
      const cookie = accountId === one.id ? one.cookie : two.cookie;
      const response = await app!.server.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { origin, cookie },
        payload: { question: 'test', mode: 'explore' },
      });
      expect(response.statusCode).toBe(201);
      await app!.session.kernel.idle();
    };
    await ask(one.id);
    expect(keys).toContain('synthetic-first');
    const count = keys.length;
    await ask(two.id);
    expect(keys).toHaveLength(count);
    expect(fallback).toHaveBeenCalled();
    await db.query(
      "update billing_secrets set envelope = jsonb_set(envelope, '{tag}', '\"broken\"') where account_id = $1",
      [one.id],
    );
    fallback.mockClear();
    keys.length = 0;
    await ask(one.id);
    expect(fallback).not.toHaveBeenCalled();
    expect(keys).toEqual([]);
    expect((await put(one.cookie, { value: 'synthetic-replaced' })).statusCode).toBe(204);
    expect(
      (
        await app.server.inject({
          method: 'DELETE',
          url: '/api/keys/openai',
          headers: { cookie: one.cookie, origin },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await app.server.inject({ url: '/api/keys', headers: { cookie: one.cookie } })).json(),
    ).toEqual({ keys: [] });
    expect((await put(one.cookie, { value: 'synthetic-restored' })).statusCode).toBe(204);
    const identity = createIdentitySlice({
      database: db,
      origin,
      secureCookies: false,
      sessionLifetimeMs: 3600000,
      loginGate: new LoginGate(),
    });
    await identity.suspend(one.id, true);
    expect((await put(one.cookie, { value: 'not-saved' })).statusCode).toBe(401);
    await app.server.close();
    // Removal stays wired even with no keyring; fresh proof does not unsuspend.
    app = await composeApp({ db, identity: options.identity, logLevel: 'silent' });
    expect(
      (
        await app.server.inject({
          method: 'POST',
          url: '/api/auth/key-removal/openai/password',
          headers: { origin },
          payload: { email: 'keys-one@example.test', password },
        })
      ).statusCode,
    ).toBe(204);
    expect(await db.query('select 1 from billing_secrets where account_id = $1', [one.id])).toEqual(
      [],
    );
    expect((await identity.getAccount(one.id))?.suspended).toBe(true);
  },
);
