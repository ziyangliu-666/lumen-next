import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { AuthFailure, createIdentitySlice, LoginGate } from '../identity/index.js';
import { composeApp } from '../../app.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { SecretCipher } from './secretCipher.js';
import { Secrets } from './secrets.js';

const cipher = new SecretCipher('test', new Map([['test', randomBytes(32)]]));
const value = 'synthetic-provider-key';

it('maps only identity eligibility rejection and preserves operational failures', async () => {
  for (const error of [
    new AuthFailure('invalid_credentials'),
    new AuthFailure('unsupported_kind'),
    new Error('database unavailable'),
    Object.assign(new Error('unrelated failure'), { code: 'invalid_credentials' }),
  ]) {
    const store = new Secrets(cipher, () => Promise.reject(error));
    const id = randomUUID();
    for (const operation of [
      () => store.list(id),
      () => store.put(id, 'openai', value),
      () => store.secret(id, 'openai'),
    ]) {
      if (error instanceof AuthFailure && error.code === 'invalid_credentials') {
        await expect(operation()).rejects.toMatchObject({
          status: 403,
          message: 'account cannot use keys',
        });
      } else {
        await expect(operation()).rejects.toBe(error);
      }
    }
  }
});

it.skipIf(!TEST_DATABASE_URL)(
  'denies missing, suspended and deleted owners through real identity without returning a fallback',
  async () => {
    const { db, drop } = await openTestDb();
    const origin = 'http://localhost:4000';
    const app = await composeApp({
      db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      logLevel: 'silent',
    });
    try {
      const identity = createIdentitySlice({
        database: db,
        origin,
        sessionLifetimeMs: 3600000,
        loginGate: new LoginGate(),
        secureCookies: false,
      });
      const store = new Secrets(cipher, (id, work) => identity.withActiveAccount(id, work));
      const denied = async (id: string): Promise<void> => {
        for (const operation of [
          () => store.list(id),
          () => store.put(id, 'openai', 'synthetic-replacement'),
          () => store.secret(id, 'openai'),
        ]) {
          await expect(operation()).rejects.toMatchObject({
            status: 403,
            message: 'account cannot use keys',
          });
        }
      };
      await denied(randomUUID());
      const email = 'secret-access@example.test';
      const password = 'correct horse battery 9';
      const signup = await app.server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin },
        payload: { email, password, displayName: 'Secret access test' },
      });
      expect(signup.statusCode).toBe(201);
      const id = signup.json<{ accountId: string }>().accountId;
      expect(await store.secret(id, 'openai')).toBeNull();
      await store.put(id, 'openai', value);
      await identity.suspend(id, true);
      await denied(id);
      await identity.suspend(id, false);
      expect(await store.secret(id, 'openai')).toBe(value);
      const login = await app.server.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { origin },
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      const cookie = login.cookies.map(({ name, value: token }) => `${name}=${token}`).join('; ');
      const deleted = await app.server.inject({
        method: 'DELETE',
        url: '/api/me',
        headers: { origin, cookie },
        payload: { currentPassword: password },
      });
      expect(deleted.statusCode).toBe(204);
      await denied(id);
    } finally {
      await app.server.close();
      await drop();
    }
  },
);
