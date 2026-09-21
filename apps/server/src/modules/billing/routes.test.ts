import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { createBillingSlice } from './index.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
});
async function build(db: Db | null): Promise<FastifyInstance> {
  app = await buildServer({
    broker: new Broker(),
    resolver: headerStub,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  await app.register(createBillingSlice({ db }).registerRoutes);
  return app;
}
const auth = { authorization: 'stub alice:user' };

it('authenticates before reporting unavailable storage', async () => {
  const server = await build(null);
  expect((await server.inject('/api/wallet')).statusCode).toBe(401);
  expect((await server.inject({ url: '/api/wallet', headers: auth })).statusCode).toBe(503);
});

describe.skipIf(!TEST_DATABASE_URL)('billing: wallet API', () => {
  let db: Db;
  let drop: () => Promise<void>;
  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
  });
  afterAll(async () => {
    await drop?.();
  });
  it('reads the owner wallet and changes only the owner cap', async () => {
    const server = await build(db);
    const response = await server.inject({
      method: 'PATCH',
      url: '/api/wallet/cap',
      headers: auth,
      payload: { accountId: 'bob', cap: { dollars: 12.123456 } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ spent: { dollars: 0 }, cap: { dollars: 12.123456 } });
    const other = await server.inject({
      url: '/api/wallet',
      headers: { authorization: 'stub bob:user' },
    });
    expect(other.json()).toEqual({ spent: { dollars: 0 }, cap: { dollars: 0 } });
  });
  it('validates cap bodies and pagination and requires authentication on every route', async () => {
    const server = await build(db);
    for (const payload of [
      {},
      { cap: { dollars: -1 } },
      { cap: { dollars: 0.0000001 } },
      { cap: { dollars: '2' } },
    ]) {
      expect(
        (await server.inject({ method: 'PATCH', url: '/api/wallet/cap', headers: auth, payload }))
          .statusCode,
      ).toBe(400);
    }
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'limit=x', 'cursor=bad']) {
      expect(
        (await server.inject({ url: `/api/wallet/ledger?${query}`, headers: auth })).statusCode,
      ).toBe(400);
    }
    expect((await server.inject({ url: '/api/wallet/ledger', headers: auth })).json()).toEqual({
      entries: [],
      nextCursor: null,
    });
    expect((await server.inject('/api/wallet/ledger')).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: '/api/wallet/cap',
          payload: { cap: { dollars: 1 } },
        })
      ).statusCode,
    ).toBe(401);
  });
});
