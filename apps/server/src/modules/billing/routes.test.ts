import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice } from './index.js';

let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});

describe('billing: wallet shell', () => {
  it('requires sign-in and returns the initial wallet for the principal', async () => {
    app = await buildServer({
      broker: new Broker(),
      resolver: headerStub,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await app.register(createBillingSlice({ db: null }).registerRoutes);
    expect((await app.inject('/api/wallet')).statusCode).toBe(401);
    const response = await app.inject({
      url: '/api/wallet',
      headers: { authorization: 'stub alice:user' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ spent: { dollars: 0 }, cap: { dollars: 0 } });
  });
});
