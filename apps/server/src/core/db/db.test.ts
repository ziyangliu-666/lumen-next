import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './db.js';
import { openTestDb, TEST_DATABASE_URL } from './testDb.js';

describe.skipIf(!TEST_DATABASE_URL)('core: database', () => {
  let db: Db;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
  });
  afterAll(() => drop());

  it('creates the base tables', async () => {
    const rows = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = current_schema() order by table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'accounts',
        'projects',
        'sessions',
        'tasks',
        'steps',
        'findings',
        'ledger_entries',
      ]),
    );
  });

  it('is safe to run twice: a second start applies nothing and breaks nothing', async () => {
    const [{ current_schema: schema } = { current_schema: '' }] = await db.query<{
      current_schema: string;
    }>('select current_schema()');
    const before = await db.query<{ name: string }>('select name from pgmigrations');
    const again = await openDatabase(TEST_DATABASE_URL!, { schema });
    const after = await again.query<{ name: string }>('select name from pgmigrations');
    await again.close();

    // Not a fixed count: every slice adds files here, and a number in this
    // test would make each of those pull requests conflict with the others.
    expect(after).toEqual(before);
    expect(after.map((row) => row.name)).toContain('001_core_base');
  });

  it('hands money back as a number, not the driver default string', async () => {
    const [row] = await db.query<{ amount: number }>('select 0.015000::numeric(12,6) as amount');
    expect(row?.amount).toBe(0.015);
  });

  it('commits a transaction that resolves', async () => {
    await db.withTransaction(async (tx) => {
      await tx.query(`insert into accounts (email, display_name) values ($1, $2)`, [
        'kept@example.com',
        'Kept',
      ]);
    });
    const rows = await db.query(`select 1 from accounts where email = $1`, ['kept@example.com']);
    expect(rows).toHaveLength(1);
  });

  it('rolls back a transaction that throws, and passes the error on', async () => {
    const attempt = db.withTransaction(async (tx) => {
      await tx.query(`insert into accounts (email, display_name) values ($1, $2)`, [
        'lost@example.com',
        'Lost',
      ]);
      throw new Error('changed my mind');
    });

    await expect(attempt).rejects.toThrow('changed my mind');
    const rows = await db.query(`select 1 from accounts where email = $1`, ['lost@example.com']);
    expect(rows).toHaveLength(0);
  });

  it('refuses a task status the contract does not know', async () => {
    await db.query(`insert into sessions (id, project_id, account_id) values ($1, 'p', 'a')`, [
      '00000000-0000-4000-8000-000000000001',
    ]);
    const attempt = db.query(
      `insert into tasks (id, session_id, status) values ($1, $2, 'paused')`,
      ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'],
    );
    await expect(attempt).rejects.toThrow(/check/);
  });
});
