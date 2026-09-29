import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { headerStub } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice, type AdminAccountReader } from './index.js';

const id = '10000000-0000-4000-8000-000000000001';
const account = {
  id,
  email: 'member@example.test',
  displayName: 'Member',
  role: 'user' as const,
  suspended: false,
  createdAt: 1_700_000_000_000,
};
const staff = { authorization: 'stub reviewer:staff' };
let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});
async function build(adminAccounts?: AdminAccountReader): Promise<void> {
  app = await buildServer({
    broker: new Broker(),
    resolver: headerStub,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  await app.register(
    createBillingSlice({ db: null, ...(adminAccounts ? { adminAccounts } : {}) }).registerRoutes,
  );
}
function reader(): AdminAccountReader {
  return {
    listAccounts: vi.fn().mockResolvedValue([account]),
    getAccount: vi.fn().mockResolvedValue(account),
  };
}

describe('billing: read-only account administration', () => {
  it('authorizes both routes before identity calls and prevents caching even on errors', async () => {
    const accounts = reader();
    await build(accounts);
    for (const url of [
      '/api/admin/accounts',
      `/api/admin/accounts/${id}`,
      '/api/admin/accounts/invalid',
    ]) {
      for (const [headers, status] of [
        [{}, 401],
        [{ authorization: 'stub member:user' }, 403],
      ] as const) {
        const response = await app.inject({ url, headers });
        expect(response.statusCode).toBe(status);
        expect(response.headers['cache-control']).toBe('no-store');
      }
    }
    expect(accounts.listAccounts).not.toHaveBeenCalled();
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });
  it('returns only public summary fields for staff on list and detail', async () => {
    const privateAccount = {
      ...account,
      passwordHash: 'must never leave identity',
      sessionToken: 'private',
    };
    const accounts = {
      listAccounts: vi.fn().mockResolvedValue([privateAccount]),
      getAccount: vi.fn().mockResolvedValue(privateAccount),
    };
    await build(accounts);
    for (const [url, body] of [
      ['/api/admin/accounts', { accounts: [account] }],
      [`/api/admin/accounts/${id}`, { account }],
    ] as const) {
      const response = await app.inject({ url, headers: staff });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(body);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(accounts.getAccount).toHaveBeenCalledWith(id);
  });
  it('supports an empty list and unavailable or deleted accounts', async () => {
    await build({
      listAccounts: () => Promise.resolve([]),
      getAccount: () => Promise.resolve(null),
    });
    expect((await app.inject({ url: '/api/admin/accounts', headers: staff })).json()).toEqual({
      accounts: [],
    });
    const response = await app.inject({ url: `/api/admin/accounts/${id}`, headers: staff });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'account is unavailable' });
  });
  it('rejects malformed IDs before identity lookup', async () => {
    const accounts = reader();
    await build(accounts);
    const response = await app.inject({ url: '/api/admin/accounts/not-a-uuid', headers: staff });
    expect(response.statusCode).toBe(400);
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });
  it('sanitizes storage failures on both endpoints', async () => {
    const fail = (): Promise<never> => Promise.reject(new Error('private database credentials'));
    await build({ listAccounts: fail, getAccount: fail });
    for (const url of ['/api/admin/accounts', `/api/admin/accounts/${id}`]) {
      const response = await app.inject({ url, headers: staff });
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('private');
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });
  it('reports unavailable identity only after staff authorization', async () => {
    await build();
    for (const url of ['/api/admin/accounts', `/api/admin/accounts/${id}`]) {
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect((await app.inject({ url, headers: staff })).statusCode).toBe(503);
    }
  });
});
