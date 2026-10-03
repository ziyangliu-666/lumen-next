import { afterEach, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { headerStub } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { adminWalletRoutes } from './adminWallet.js';

const id = '10000000-0000-4000-8000-000000000001';
const staff = { authorization: 'stub reviewer:staff' };
const account = {
  id,
  email: 'owner@example.test',
  displayName: 'Owner',
  role: 'user' as const,
  suspended: false,
  createdAt: 1_700_000_000_000,
};
const accounts = {
  listAccounts: vi.fn().mockResolvedValue([]),
  getAccount: vi.fn().mockResolvedValue(account),
};
const ledger = {
  monthSpend: vi.fn().mockResolvedValue({ spent: { dollars: 0.3 }, cap: { dollars: 0 } }),
};
let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
  vi.clearAllMocks();
  accounts.getAccount.mockResolvedValue(account);
  ledger.monthSpend.mockResolvedValue({ spent: { dollars: 0.3 }, cap: { dollars: 0 } });
});
async function build(database = true, identity = true): Promise<void> {
  app = await buildServer({
    broker: new Broker(),
    resolver: headerStub,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  await app.register(adminWalletRoutes(database ? ledger : null, identity ? accounts : undefined));
}

it('authorizes staff before identity or wallet access and prevents caching', async () => {
  await build();
  for (const [headers, status] of [
    [{}, 401],
    [{ authorization: 'stub owner:user' }, 403],
  ] as const) {
    const response = await app.inject({ url: `/api/admin/accounts/${id}/wallet`, headers });
    expect(response.statusCode).toBe(status);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(accounts.getAccount).not.toHaveBeenCalled();
  expect(ledger.monthSpend).not.toHaveBeenCalled();
});
it('selects the path owner and returns their stored summary including a zero cap', async () => {
  await build();
  const response = await app.inject({
    url: `/api/admin/accounts/${id}/wallet?accountId=someone-else`,
    headers: staff,
  });
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.json()).toEqual({ spent: { dollars: 0.3 }, cap: { dollars: 0 } });
  expect(accounts.getAccount).toHaveBeenCalledWith(id);
  expect(ledger.monthSpend).toHaveBeenCalledWith(id);
});
it('refuses malformed and unresolved accounts before reading a default wallet', async () => {
  await build();
  expect(
    (await app.inject({ url: '/api/admin/accounts/invalid/wallet', headers: staff })).statusCode,
  ).toBe(400);
  expect(accounts.getAccount).not.toHaveBeenCalled();
  accounts.getAccount.mockResolvedValue(null);
  expect(
    (await app.inject({ url: `/api/admin/accounts/${id}/wallet`, headers: staff })).statusCode,
  ).toBe(404);
  expect(ledger.monthSpend).not.toHaveBeenCalled();
});
it.each([
  [false, true],
  [true, false],
])('requires both dependencies (database %s, identity %s)', async (database, identity) => {
  await build(database, identity);
  expect(
    (await app.inject({ url: `/api/admin/accounts/${id}/wallet`, headers: staff })).statusCode,
  ).toBe(503);
});
it.each(['identity', 'ledger'])('sanitizes a failure in %s', async (dependency) => {
  await build();
  (dependency === 'identity' ? accounts.getAccount : ledger.monthSpend).mockRejectedValue(
    new Error('private database connection'),
  );
  const response = await app.inject({ url: `/api/admin/accounts/${id}/wallet`, headers: staff });
  expect(response.statusCode).toBe(500);
  expect(response.body).not.toContain('private');
  expect(response.headers['cache-control']).toBe('no-store');
});
