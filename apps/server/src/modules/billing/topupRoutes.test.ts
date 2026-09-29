import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { badRequest } from '../../core/http/httpError.js';
import { Broker } from '../../core/protocol/broker.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { createBillingSlice, type TopupProvider } from './index.js';

const origin = 'https://lumen.test';
const auth = { authorization: 'stub alice:user', origin };
describe.skipIf(!TEST_DATABASE_URL)('top-up HTTP boundaries', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let app: FastifyInstance;
  const checkout = vi.fn<TopupProvider['checkout']>();
  const paidEvent = vi.fn<TopupProvider['paidEvent']>();
  const canSpend = vi.fn<(_: string) => Promise<boolean>>();
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    checkout
      .mockReset()
      .mockImplementation((order) =>
        Promise.resolve({ id: `cs_test_${order.id}`, url: 'https://checkout.stripe.com/test' }),
      );
    paidEvent.mockReset().mockReturnValue(null);
    canSpend.mockReset().mockResolvedValue(true);
    app = await buildServer({
      broker: new Broker(),
      resolver: headerStub,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(
      createBillingSlice({ db, origin, canSpend, topups: { checkout, paidEvent } }).registerRoutes,
    );
  });
  afterEach(async () => {
    await app?.close();
    await drop?.();
  });
  const payload = (): { requestId: string; offer: string } => ({
    requestId: randomUUID(),
    offer: 'usd5',
  });
  it('authenticates, checks origin and eligibility, and ignores browser-selected owners or amounts', async () => {
    const post = (
      headers: Record<string, string>,
      body = payload(),
    ): Promise<Awaited<ReturnType<typeof app.inject>>> =>
      app.inject({ method: 'POST', url: '/api/wallet/topups/checkout', headers, payload: body });
    expect((await post({})).statusCode).toBe(401);
    expect((await post({ ...auth, origin: 'https://foreign.test' })).statusCode).toBe(403);
    canSpend.mockResolvedValueOnce(false);
    expect((await post(auth)).statusCode).toBe(403);
    expect((await post(auth, { ...payload(), offer: 'usd100' })).statusCode).toBe(400);
    expect(checkout).not.toHaveBeenCalled();
    const body = { ...payload(), accountId: 'bob', amount: 100 };
    expect((await post(auth, body)).statusCode).toBe(200);
    expect(checkout.mock.calls[0]?.[0].accountId).toBe('alice');
    expect((await app.inject({ url: '/api/wallet', headers: auth })).json()).toMatchObject({
      cap: { dollars: 1 },
    });
  });
  it('preserves signed bytes, credits on the webhook alone and keeps ordinary JSON parsing intact', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/wallet/topups/checkout',
      headers: auth,
      payload: payload(),
    });
    const order = checkout.mock.calls[0]![0];
    const payment = {
      orderId: order.id,
      checkoutId: `cs_test_${order.id}`,
      paymentId: 'pi_one',
      cents: '500',
    };
    const raw = '{  "fixture": true }\n';
    paidEvent.mockReturnValue(payment);
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/billing/stripe/webhook',
            headers: { 'content-type': 'application/json', 'stripe-signature': 'signed' },
            payload: raw,
          })
        ).statusCode,
      ).toBe(200);
    }
    expect(paidEvent).toHaveBeenCalledWith(Buffer.from(raw), 'signed');
    const list = await app.inject({ url: '/api/wallet/topups', headers: auth });
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.json<{ receipts: unknown[] }>().receipts).toHaveLength(1);
    expect(
      (
        await app.inject({ url: '/api/wallet/topups', headers: { authorization: 'stub bob:user' } })
      ).json(),
    ).toEqual({ enabled: true, receipts: [] });
    expect((await app.inject({ url: '/api/wallet', headers: auth })).json()).toMatchObject({
      cap: { dollars: 6 },
    });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/wallet/cap',
          headers: auth,
          payload: { cap: { dollars: 2 } },
        })
      ).statusCode,
    ).toBe(200);
  });
  it('rejects missing or invalid signatures and safely acknowledges unrelated events', async () => {
    const send = (
      headers: Record<string, string>,
    ): Promise<Awaited<ReturnType<typeof app.inject>>> =>
      app.inject({
        method: 'POST',
        url: '/api/billing/stripe/webhook',
        headers: { 'content-type': 'application/json', ...headers },
        payload: '{}',
      });
    expect((await send({})).statusCode).toBe(400);
    paidEvent.mockImplementationOnce(() => {
      throw badRequest('invalid webhook signature');
    });
    expect((await send({ 'stripe-signature': 'bad' })).statusCode).toBe(400);
    expect((await send({ 'stripe-signature': 'ok' })).statusCode).toBe(200);
    expect((await app.inject('/api/wallet/topups')).statusCode).toBe(401);
  });
});
