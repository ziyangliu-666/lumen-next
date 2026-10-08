import { afterEach, describe, expect, it } from 'vitest';
import type { App } from './app.js';
import { composeApp } from './app.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';

const origin = 'http://localhost:4000';
const password = 'correct horse battery 9';
let app: App | undefined;
let drop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await app?.server.close();
  await drop?.();
});

// Billing's ciphertext cleanup is wired by the composition root even though key
// usage is not configured (no keyring) and the Keys routes are off.
describe.skipIf(!TEST_DATABASE_URL)('composed key lifecycle cleanup', () => {
  async function setup(email: string) {
    const opened = await openTestDb();
    drop = opened.drop;
    app = await composeApp({
      db: opened.db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      logLevel: 'silent',
    });
    const signup = await app.server.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Key owner', password },
    });
    expect(signup.statusCode).toBe(201);
    const accountId = signup.json<{ accountId: string }>().accountId;
    const cookie = signup.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
    await opened.db.query(
      `insert into billing_secrets (account_id, provider, envelope) values ($1, 'openai', '{"keyId":"fixture"}'::jsonb)`,
      [accountId],
    );
    const stored = async (): Promise<number> =>
      (
        await opened.db.query<{ n: number }>(
          'select count(*)::int as n from billing_secrets where account_id = $1',
          [accountId],
        )
      )[0]!.n;
    return { cookie, stored, email };
  }

  it('erases stored ciphertext in the same transaction as account deletion', async () => {
    const { cookie, stored } = await setup('delete-keys@example.test');
    expect(await stored()).toBe(1);
    const deleted = await app!.server.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { origin, cookie },
      payload: { currentPassword: password },
    });
    expect(deleted.statusCode).toBe(204);
    expect(await stored()).toBe(0);
  });

  it('lets fresh password proof remove only the key and keeps the account', async () => {
    const { cookie, stored, email } = await setup('remove-key@example.test');
    const wrong = await app!.server.inject({
      method: 'POST',
      url: '/api/auth/key-removal/openai/password',
      headers: { origin },
      payload: { email, password: 'not the password 99' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(await stored()).toBe(1);
    const removed = await app!.server.inject({
      method: 'POST',
      url: '/api/auth/key-removal/openai/password',
      headers: { origin },
      payload: { email, password },
    });
    expect(removed.statusCode).toBe(204);
    expect(await stored()).toBe(0);
    const me = await app!.server.inject({ url: '/api/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
  });
});
