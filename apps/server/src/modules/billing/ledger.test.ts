import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { Ledger } from './ledger.js';
import { createBillingSlice } from './index.js';

describe.skipIf(!TEST_DATABASE_URL)('billing: Postgres ledger', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let ledger: Ledger;
  let taskId: string;
  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
    ledger = new Ledger(db);
    const sessionId = randomUUID();
    taskId = randomUUID();
    await db.query("insert into sessions (id, project_id, account_id) values ($1, 'p', 'alice')", [
      sessionId,
    ]);
    await db.query('insert into tasks (id, session_id) values ($1, $2)', [taskId, sessionId]);
  });
  afterAll(async () => {
    await drop?.();
  });

  it('counts concurrent writes without losing a charge', async () => {
    await Promise.all(
      [0.1, 0.2].map((dollars) =>
        ledger.record({ accountId: 'alice', taskId, amount: { dollars }, reason: 'model' }),
      ),
    );
    // Fix only the fixture timestamps; production uses database time.
    await db.query(
      "update ledger_entries set created_at = '2026-09-21T12:00:00Z' where account_id = 'alice'",
    );
    expect((await ledger.monthSpend('alice')).spent.dollars).toBe(0.3);
  });

  it('keeps all recorded spend across month boundaries without resetting the cap', async () => {
    await db.query(`insert into ledger_entries (account_id, amount, reason, created_at) values
      ('boundary', 10, 'previous', '2026-08-31T23:59:59.999999Z'),
      ('boundary', 0.1, 'first', '2026-09-01T00:00:00Z'),
      ('boundary', 0.2, 'last', '2026-09-30T23:59:59.999999Z'),
      ('boundary', 20, 'next', '2026-10-01T00:00:00Z')`);
    await ledger.setCap('boundary', { dollars: 5.123456 });
    expect(await ledger.monthSpend('boundary')).toEqual({
      spent: { dollars: 30.3 },
      cap: { dollars: 5.123456 },
    });
    expect(await ledger.monthSpend('stranger')).toEqual({
      spent: { dollars: 0 },
      cap: { dollars: 1 },
    });
    expect((await ledger.list('stranger', 20)).entries).toEqual([]);
  });

  it('paginates tied microsecond timestamps without duplicates or crossing accounts', async () => {
    await db.query(`insert into ledger_entries (account_id, amount, reason, created_at)
      select 'pages', 0.01, n::text, '2026-09-21T12:00:00.123456Z'::timestamptz from generate_series(1,5) n`);
    const first = await ledger.list('pages', 2);
    const second = await ledger.list('pages', 2, first.nextCursor!);
    const third = await ledger.list('pages', 2, second.nextCursor!);
    expect(
      new Set([...first.entries, ...second.entries, ...third.entries].map((e) => e.id)).size,
    ).toBe(5);
    expect(third.nextCursor).toBeNull();
    expect((await ledger.list('stranger', 2, first.nextCursor!)).entries).toEqual([]);
  });

  it('does not round invalid amounts into valid charges or caps', async () => {
    for (const dollars of [-1, NaN, Infinity, 0.0000001, 1000000]) {
      await expect(
        ledger.record({ accountId: 'alice', taskId, amount: { dollars }, reason: 'bad' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(ledger.setCap('alice', { dollars })).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      ledger.record({
        accountId: 'alice',
        taskId: 'not-a-task',
        amount: { dollars: 1 },
        reason: 'bad',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(ledger.list('alice', 20, 'garbage')).rejects.toMatchObject({ status: 400 });
  });

  it('can participate in a transaction that rolls back', async () => {
    await expect(
      db.withTransaction(async (tx) => {
        await ledger.record(
          { accountId: 'rollback', taskId, amount: { dollars: 1 }, reason: 'rollback' },
          tx,
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect((await ledger.list('rollback', 20)).entries).toEqual([]);
  });

  it('compares exact decimals across months in SQL and isolates accounts', async () => {
    await db.query(`insert into ledger_entries (account_id, amount, reason, created_at) values
      ('budget', 0, 'current', '2026-09-21T12:00:00Z'),
      ('budget', 0.1, 'previous', '2026-08-31T23:59:59Z'),
      ('budget-other', 100, 'foreign', '2026-09-21T12:00:00Z')`);
    await ledger.setCap('budget', { dollars: 0.3 });
    expect(await ledger.fits('budget', { dollars: 0.2 })).toBe(true);
    expect(await ledger.fits('budget', { dollars: 0.200001 })).toBe(false);
    expect(await ledger.fits('unknown', { dollars: 0.000001 })).toBe(true);
    expect(await ledger.fits('unknown', { dollars: 0 })).toBe(true);
  });

  it.each([
    [0.999999, 'allow'],
    [1, 'allow'],
    [1.000001, 'deny'],
  ] as const)(
    'checks a fresh account estimate %s against the SQL default',
    async (dollars, kind) => {
      const accountId = `fresh-${dollars}`;
      const billing = createBillingSlice({ db, canSpend: () => Promise.resolve(true) });
      expect(await billing.monthSpend(accountId)).toEqual({
        spent: { dollars: 0 },
        cap: { dollars: 1 },
      });
      expect(
        await billing.budgetGuard.check({
          accountId,
          taskId,
          attemptId: 'attempt-1',
          estimate: { dollars },
          at: 'turn',
          reason: 'boundary',
        }),
      ).toMatchObject({ kind });
      expect(
        await db.query('select 1 from billing_wallets where account_id = $1', [accountId]),
      ).toEqual([]);
    },
  );

  it('preserves a saved zero and requires remaining room for an unknown estimate', async () => {
    await ledger.setCap('zero', { dollars: 0 });
    expect((await ledger.monthSpend('zero')).cap.dollars).toBe(0);
    expect(await ledger.fits('zero', { dollars: 0 })).toBe(false);
    expect(await ledger.fits('zero', { dollars: 0.000001 })).toBe(false);
    await db.query(
      "insert into ledger_entries (account_id, amount, reason) values ('exhausted', 1, 'spent')",
    );
    expect(await ledger.fits('exhausted', { dollars: 0 })).toBe(false);
    expect(await ledger.fits('fresh-unknown', { dollars: 0 })).toBe(true);
    await ledger.setCap('exhausted', { dollars: 0.5 });
    expect(await ledger.fits('exhausted', { dollars: 0 })).toBe(false);
  });

  it('wires the public guard to the stored cap and ledger', async () => {
    await ledger.setCap('wired', { dollars: 1 });
    const billing = createBillingSlice({ db, canSpend: (id) => Promise.resolve(id === 'wired') });
    const charge = {
      accountId: 'wired',
      taskId,
      attemptId: 'attempt-1',
      estimate: { dollars: 1 },
      at: 'turn' as const,
      reason: 'model',
    };
    expect(await billing.budgetGuard.check(charge)).toEqual({ kind: 'allow' });
    await billing.record({ accountId: 'wired', taskId, amount: { dollars: 1 }, reason: 'model' });
    expect(await billing.budgetGuard.check(charge)).toEqual({
      kind: 'deny',
      reason: 'over the cap',
    });
  });
});
