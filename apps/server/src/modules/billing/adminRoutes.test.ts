import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AdminAccounts, AccountSummary } from '../identity/index.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice } from './index.js';

const account: AccountSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.edu',
  displayName: 'Member',
  role: 'user',
  suspended: false,
  createdAt: 1_700_000_000_000,
};

const servers: FastifyInstance[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const server of servers.splice(0)) await server.close();
});

interface AdminAccountsFixture {
  readonly accounts: AdminAccounts;
  readonly listAccounts: Mock<AdminAccounts['listAccounts']>;
  readonly getAccount: Mock<AdminAccounts['getAccount']>;
}

function adminAccounts(): AdminAccountsFixture {
  const listAccounts = vi.fn<AdminAccounts['listAccounts']>().mockResolvedValue([account]);
  const getAccount = vi.fn<AdminAccounts['getAccount']>().mockResolvedValue(account);
  return {
    accounts: {
      listAccounts,
      getAccount,
      setRole: vi.fn(),
      suspend: vi.fn(),
    } satisfies AdminAccounts,
    listAccounts,
    getAccount,
  };
}

async function setup(accounts: AdminAccounts): Promise<FastifyInstance> {
  const app = await buildServer({
    broker: new Broker(),
    resolver: {
      resolve: ({ authorization }) =>
        Promise.resolve(
          authorization === 'staff'
            ? { accountId: 'staff-id', role: 'staff' }
            : authorization === 'user'
              ? { accountId: 'user-id', role: 'user' }
              : null,
        ),
    },
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  servers.push(app);
  await app.register(createBillingSlice({ accounts }).registerRoutes);
  return app;
}

describe('billing: read-only admin account routes', () => {
  it('lists safe identity summaries for staff without caching them', async () => {
    const fixture = adminAccounts();
    const response = await (
      await setup(fixture.accounts)
    ).inject({
      url: '/api/admin/accounts',
      headers: { authorization: 'staff' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([account]);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(fixture.listAccounts).toHaveBeenCalledOnce();
  });

  it.each([
    ['anonymous', undefined, 401],
    ['member', 'user', 403],
  ])('refuses %s account lists before calling identity', async (_name, authorization, status) => {
    const fixture = adminAccounts();
    const response = await (
      await setup(fixture.accounts)
    ).inject({
      url: '/api/admin/accounts',
      ...(authorization ? { headers: { authorization } } : {}),
    });

    expect(response.statusCode).toBe(status);
    expect(fixture.listAccounts).not.toHaveBeenCalled();
  });

  it('returns one account to staff', async () => {
    const fixture = adminAccounts();
    const response = await (
      await setup(fixture.accounts)
    ).inject({
      url: `/api/admin/accounts/${account.id}`,
      headers: { authorization: 'staff' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(account);
    expect(fixture.getAccount).toHaveBeenCalledWith(account.id);
  });

  it('rejects malformed account ids before calling identity', async () => {
    const fixture = adminAccounts();
    const response = await (
      await setup(fixture.accounts)
    ).inject({
      url: '/api/admin/accounts/not-a-uuid',
      headers: { authorization: 'staff' },
    });

    expect(response.statusCode).toBe(400);
    expect(fixture.getAccount).not.toHaveBeenCalled();
  });

  it('returns 404 when the account no longer exists', async () => {
    const fixture = adminAccounts();
    fixture.getAccount.mockResolvedValue(null);
    const response = await (
      await setup(fixture.accounts)
    ).inject({
      url: `/api/admin/accounts/${account.id}`,
      headers: { authorization: 'staff' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('does not expose mutation routes in the read-only increment', async () => {
    const response = await (
      await setup(adminAccounts().accounts)
    ).inject({
      method: 'PATCH',
      url: `/api/admin/accounts/${account.id}`,
      headers: { authorization: 'staff' },
      payload: { role: 'staff' },
    });

    expect(response.statusCode).toBe(404);
  });
});
