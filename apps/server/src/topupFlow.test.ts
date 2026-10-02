import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from './app.js';
import { composeApp } from './app.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';
import type { Worker } from './core/domain/worker.js';

const origin = 'http://localhost:4000';
const stripe = { secretKey: 'sk_test_fixture', webhookSecret: 'whsec_fixture', origin };
let app: App | undefined;
let drop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await app?.server.close();
  await app?.session.kernel.idle();
  await drop?.();
});

it('refuses a configured payment provider without real identity and persistence', async () => {
  await expect(composeApp({ db: null, identity: null, stripe })).rejects.toThrow('Stripe requires');
});

describe.skipIf(!TEST_DATABASE_URL)('composed signed Stripe payment', () => {
  it('credits only a signed payment, survives restart and lets a new step use the raised cap', async () => {
    const opened = await openTestDb();
    drop = opened.drop;
    const run = vi.fn<Worker['run']>().mockResolvedValue(undefined);
    const options = {
      db: opened.db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      stripe,
      worker: { run },
      logLevel: 'silent',
    };
    app = await composeApp(options);
    const sign = await app.server.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: {
        email: 'topup@example.test',
        displayName: 'Topup owner',
        password: 'correct horse battery 9',
      },
    });
    expect(sign.statusCode).toBe(201);
    const cookie = sign.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
    const headers = { cookie, origin };
    await app.server.inject({
      method: 'PATCH',
      url: '/api/wallet/cap',
      headers,
      payload: { cap: { dollars: 0 } },
    });
    const ask = (): Promise<unknown> =>
      app!.server.inject({
        method: 'POST',
        url: '/api/projects',
        headers,
        payload: { question: 'A paid test step', mode: 'explore' },
      });
    await ask();
    await app.session.kernel.idle();
    expect(run).not.toHaveBeenCalled();
    // Persist the same billing order created by checkout, without contacting Stripe in CI.
    // Integration uses billing's own table; no other slice's internals are accessed.
    const orderId = randomUUID();
    await opened.db.query(
      'insert into billing_topups (id, account_id, request_id, amount) values ($1,$2,$3,5.000000)',
      [orderId, sign.json<{ accountId: string }>().accountId, randomUUID()],
    );
    const payload = JSON.stringify({
      id: 'evt_composed',
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_test_composed',
          object: 'checkout.session',
          livemode: false,
          mode: 'payment',
          status: 'complete',
          payment_status: 'paid',
          currency: 'usd',
          amount_total: 500,
          payment_intent: 'pi_composed',
          client_reference_id: orderId,
          metadata: { lumen_topup: orderId },
        },
      },
    });
    const signature = new Stripe(stripe.secretKey).webhooks.generateTestHeaderString({
      payload,
      secret: stripe.webhookSecret,
    });
    const webhook = (sig: string): Promise<Awaited<ReturnType<App['server']['inject']>>> =>
      app!.server.inject({
        method: 'POST',
        url: '/api/billing/stripe/webhook',
        headers: { 'content-type': 'application/json', 'stripe-signature': sig },
        payload,
      });
    expect((await webhook('bad')).statusCode).toBe(400);
    expect((await webhook(signature)).statusCode).toBe(200);
    await app.server.close();
    app = await composeApp(options);
    expect((await webhook(signature)).statusCode).toBe(200);
    const wallet = await app.server.inject({ url: '/api/wallet', headers });
    expect(wallet.json()).toEqual({ cap: { dollars: 5 }, spent: { dollars: 0 } });
    await ask();
    await app.session.kernel.idle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(
      (await app.server.inject({ url: '/api/wallet/topups', headers })).json<{
        receipts: unknown[];
      }>().receipts,
    ).toHaveLength(1);
    expect(
      (
        await app.server.inject({
          url: '/api/wallet/topups',
          headers: { authorization: 'stub forged:user' },
        })
      ).statusCode,
    ).toBe(401);
  });
});
