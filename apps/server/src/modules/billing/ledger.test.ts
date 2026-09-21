import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import { Ledger } from './ledger.js';

describe.skipIf(!TEST_DATABASE_URL)('billing: Postgres ledger', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let ledger: Ledger;
  let taskId: string;
  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
    ledger = new Ledger(db, () => new Date('2026-09-21T12:00:00Z'));
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

  it('uses UTC month boundaries and excludes the next month', async () => {
    await db.query(`insert into ledger_entries (account_id, amount, reason, created_at) values
      ('boundary', 10, 'previous', '2026-08-31T23:59:59.999999Z'),
      ('boundary', 0.1, 'first', '2026-09-01T00:00:00Z'),
      ('boundary', 0.2, 'last', '2026-09-30T23:59:59.999999Z'),
      ('boundary', 20, 'next', '2026-10-01T00:00:00Z')`);
    await ledger.setCap('boundary', { dollars: 5.123456 });
    expect(await ledger.monthSpend('boundary')).toEqual({
      spent: { dollars: 0.3 },
      cap: { dollars: 5.123456 },
    });
    expect(await ledger.monthSpend('stranger')).toEqual({
      spent: { dollars: 0 },
      cap: { dollars: 0 },
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
});
