import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildServer } from '../../core/http/server.js';
import { headerStub } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { createBillingSlice, type AdminAccountReader } from './index.js';

const staff = { authorization: 'stub reviewer:staff' };
const reader = (): AdminAccountReader => ({
  listAccounts: vi.fn().mockResolvedValue([]),
  getAccount: vi.fn().mockResolvedValue(null),
});
let app: FastifyInstance;
let drop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await app?.close();
  await drop?.();
  drop = undefined;
});
async function build(db: Db | null, adminAccounts?: AdminAccountReader): Promise<void> {
  app = await buildServer({
    broker: new Broker(),
    resolver: headerStub,
    access: { canWatch: () => Promise.resolve(false) },
    logLevel: 'silent',
  });
  await app.register(
    createBillingSlice({ db, ...(adminAccounts ? { adminAccounts } : {}) }).registerRoutes,
  );
}

it('authorizes the ledger before dependency checks and never caches errors', async () => {
  const accounts = reader();
  await build(null, accounts);
  for (const [headers, status] of [
    [{}, 401],
    [{ authorization: 'stub member:user' }, 403],
    [staff, 503],
  ] as const) {
    const response = await app.inject({ url: '/api/admin/ledger', headers });
    expect(response.statusCode).toBe(status);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(accounts.getAccount).not.toHaveBeenCalled();
});

describe.skipIf(!TEST_DATABASE_URL)('billing: staff ledger', () => {
  async function setup(accounts?: AdminAccountReader): Promise<Db> {
    const test = await openTestDb();
    drop = test.drop;
    await build(test.db, accounts);
    return test.db;
  }
  it('labels unresolved owners and paginates tied microseconds without losing history', async () => {
    const accounts = reader();
    const db = await setup(accounts);
    await db.query(`insert into ledger_entries (account_id, amount, reason, created_at)
      select 'deleted-owner', 0.123456, 'private expense text', '2026-10-03T12:00:00.123456Z'::timestamptz from generate_series(1,5)`);
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const response: LightMyRequestResponse = await app.inject({
        url: `/api/admin/ledger?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
        headers: staff,
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const page = response.json<{ entries: { id: string }[]; nextCursor: string | null }>();
      for (const row of page.entries) {
        expect(row).toEqual({
          id: row.id,
          accountId: 'deleted-owner',
          accountLabel: 'Deleted account',
          taskId: null,
          amount: { dollars: 0.123456 },
          createdAt: '2026-10-03T12:00:00.123Z',
        });
        ids.push(row.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(accounts.getAccount).toHaveBeenCalledTimes(3);
    const gone = Buffer.from(randomUUID()).toString('base64url');
    expect(
      (await app.inject({ url: `/api/admin/ledger?cursor=${gone}`, headers: staff })).json(),
    ).toEqual({ entries: [], nextCursor: null });
  });
  it('does not describe a failed identity lookup as a deleted account', async () => {
    const accounts = reader();
    vi.mocked(accounts.getAccount).mockRejectedValue(new Error('private storage failure'));
    const db = await setup(accounts);
    await db.query(
      "insert into ledger_entries (account_id, amount, reason) values ('owner', 0.2, 'expense')",
    );
    const response = await app.inject({ url: '/api/admin/ledger', headers: staff });
    expect(response.statusCode).toBe(500);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toMatch(/private|Deleted account/);
  });
  it('rejects invalid pages before querying identity', async () => {
    const accounts = reader();
    await setup(accounts);
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=-1',
      'limit=2.5',
      'limit=oops',
      'cursor=invalid',
    ]) {
      expect(
        (await app.inject({ url: `/api/admin/ledger?${query}`, headers: staff })).statusCode,
      ).toBe(400);
    }
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });
  it('requires identity instead of labelling every account deleted', async () => {
    await setup();
    expect((await app.inject({ url: '/api/admin/ledger', headers: staff })).statusCode).toBe(503);
  });
});
