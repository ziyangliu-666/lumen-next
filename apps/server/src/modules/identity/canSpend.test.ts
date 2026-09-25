import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice } from '../billing/index.js';
import { createIdentitySlice, type IdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { AUTH_COOKIE } from './sessionStrategy.js';

const origin = 'https://lumen.example';
const password = 'testpass';

describe.skipIf(!TEST_DATABASE_URL)('identity: account eligibility for billing', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  let db: IdentityDatabase;
  let identity: IdentitySlice;
  let app: FastifyInstance;

  beforeAll(async () => {
    fixture = await openTestDb();
    db = fixture.db;
  }, 60_000);

  beforeEach(async () => {
    await db.query(
      'truncate accounts, projects, sessions, ledger_entries, billing_wallets cascade',
      [],
    );
    identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 60 * 60_000,
      loginGate: new LoginGate(),
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
    await app.close();
  });

  afterAll(async () => {
    await fixture?.drop();
  });

  async function signup(email: string): Promise<{ accountId: string; cookie: string }> {
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

  it('lets a live account spend', async () => {
    const { accountId } = await signup('live@example.edu');
    expect(await identity.canSpend(accountId)).toBe(true);
  });

  it('refuses a suspended account, and lets it spend again once unsuspended', async () => {
    const { accountId } = await signup('suspended@example.edu');
    await identity.suspend(accountId, true);
    expect(await identity.canSpend(accountId)).toBe(false);
    await identity.suspend(accountId, false);
    expect(await identity.canSpend(accountId)).toBe(true);
  });

  it('refuses a deleted account', async () => {
    const { accountId, cookie } = await signup('deleted@example.edu');
    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { origin },
      cookies: { [AUTH_COOKIE]: cookie },
      payload: { currentPassword: password },
    });
    expect(removed.statusCode).toBe(204);
    expect(await identity.canSpend(accountId)).toBe(false);
  });

  it('refuses an unknown or malformed id', async () => {
    expect(await identity.canSpend(randomUUID())).toBe(false);
    expect(await identity.canSpend('not-an-account')).toBe(false);
  });

  it('is the check billing asks before its cap', async () => {
    const { accountId } = await signup('billing@example.edu');
    const billing = createBillingSlice({ db: fixture.db, canSpend: identity.canSpend });
    const charge = {
      accountId,
      taskId: randomUUID(),
      estimate: { dollars: 0.01 },
      at: 'task-open' as const,
      reason: 'test',
    };
    // A live account gets past the account check; a new account's cap is 0.
    expect(await billing.budgetGuard.check(charge)).toEqual({
      kind: 'deny',
      reason: 'over the cap',
    });
    await identity.suspend(accountId, true);
    expect(await billing.budgetGuard.check(charge)).toEqual({
      kind: 'deny',
      reason: 'account cannot spend',
    });
  });
});
