import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { headerStub } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice, type TopupProvider } from './index.js';

// Exercise the real shared HTTP layer: route-only tests can miss errors raised
// before a handler runs, including JSON parsing and content-type/body limits.
describe('billing: shared HTTP rejection boundaries', () => {
  let app: FastifyInstance;
  const canSpend = vi.fn<(_: string) => Promise<boolean>>();
  const checkout = vi.fn<TopupProvider['checkout']>();
  const paidEvent = vi.fn<TopupProvider['paidEvent']>();
  beforeEach(async () => {
    canSpend.mockReset().mockResolvedValue(true);
    checkout.mockReset();
    paidEvent.mockReset();
    app = await buildServer({
      broker: new Broker(),
      resolver: headerStub,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(
      createBillingSlice({
        db: null,
        origin: 'https://lumen.test',
        canSpend,
        topups: { checkout, paidEvent },
      }).registerRoutes,
    );
  });
  afterEach(async () => {
    await app.close();
  });

  const routes = [
    { method: 'PATCH' as const, url: '/api/wallet/cap' },
    { method: 'POST' as const, url: '/api/wallet/topups/checkout' },
    {
      method: 'POST' as const,
      url: '/api/wallet/approvals/00000000-0000-4000-8000-000000000001/grant',
    },
    {
      method: 'POST' as const,
      url: '/api/wallet/approvals/00000000-0000-4000-8000-000000000001/reject',
    },
  ];
  for (const route of routes) {
    it.each([
      { name: 'malformed JSON', contentType: 'application/json', payload: '{', status: 400 },
      {
        name: 'unsupported media type',
        contentType: 'application/xml',
        payload: '<x/>',
        status: 415,
      },
      {
        name: 'oversized JSON',
        contentType: 'application/json',
        payload: JSON.stringify('x'.repeat(1024 * 1024)),
        status: 413,
      },
    ])(
      `rejects $name before business logic at ${route.url}`,
      async ({ contentType, payload, status }) => {
        const response = await app.inject({
          ...route,
          headers: {
            authorization: 'stub alice:user',
            origin: 'https://lumen.test',
            'content-type': contentType,
          },
          payload,
        });
        expect(response.statusCode).toBe(status);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(canSpend).not.toHaveBeenCalled();
        expect(checkout).not.toHaveBeenCalled();
        expect(paidEvent).not.toHaveBeenCalled();
      },
    );
  }

  it('keeps the smaller raw webhook limit and never calls signature processing for oversized input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/billing/stripe/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'fixture' },
      payload: 'x'.repeat(262145),
    });
    expect(response.statusCode).toBe(413);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(paidEvent).not.toHaveBeenCalled();
  });
});
