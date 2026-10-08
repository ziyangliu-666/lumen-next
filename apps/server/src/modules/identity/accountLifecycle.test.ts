import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { AuthFailure } from './authFlow.js';
import { createIdentitySlice } from './createIdentitySlice.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { LoginGate } from './loginGate.js';
import { PostgresAccountStore } from './postgresStores.js';

function signal(): { promise: Promise<void>; release: () => void } {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('identity: active-account transaction contract', () => {
  it('rejects a malformed id without touching storage or invoking the consumer', async () => {
    const transaction = vi.fn();
    const db: IdentityDatabase = { query: vi.fn(), withTransaction: transaction };
    const work = vi.fn();
    const slice = createIdentitySlice({
      database: db,
      origin: 'https://example.test',
      sessionLifetimeMs: 1000,
      loginGate: new LoginGate(),
    });
    await expect(slice.withActiveAccount('invalid', work)).rejects.toBeInstanceOf(AuthFailure);
    expect(transaction).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });

  it('passes the locked transaction, returns the result, and propagates commit errors', async () => {
    const tx: IdentitySql = { query: vi.fn().mockResolvedValue([{ id: randomUUID() }]) };
    const commitFailure = new Error('commit failed');
    const poolQuery = vi.fn();
    const db: IdentityDatabase = {
      query: poolQuery,
      withTransaction: async (work) => {
        await work(tx);
        throw commitFailure;
      },
    };
    const work = vi.fn().mockResolvedValue('saved');
    await expect(new PostgresAccountStore(db).withActiveAccount(randomUUID(), work)).rejects.toBe(
      commitFailure,
    );
    expect(work).toHaveBeenCalledWith(tx);
    expect(poolQuery).not.toHaveBeenCalled();
  });
});

// A consumer-owned fixture proves the public callback contract, not Billing activation.
describe.skipIf(!TEST_DATABASE_URL)('identity: account lifecycle with PostgreSQL', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let id: string;
  let store: PostgresAccountStore;
  const proof = { kind: 'password' as const, expectedHash: 'synthetic-version' };
  const erase = async (accountId: string, tx: IdentitySql): Promise<void> => {
    await tx.query('delete from identity_lifecycle_fixture where account_id = $1', [accountId]);
  };
  const write = async (tx: IdentitySql): Promise<string> => {
    await tx.query('insert into identity_lifecycle_fixture (account_id) values ($1)', [id]);
    return 'saved';
  };
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    store = new PostgresAccountStore(db, erase);
    const account = await store.createPasswordAccount({
      email: 'lifecycle@example.test',
      displayName: 'Fixture',
      passwordHash: proof.expectedHash,
    });
    id = account.id;
    await db.query('create table identity_lifecycle_fixture (account_id uuid primary key)');
  });
  afterEach(async () => {
    await drop();
  });

  it('commits consumer work and rejects unknown, suspended and deleted owners', async () => {
    expect(await store.withActiveAccount(id, write)).toBe('saved');
    const work = vi.fn();
    await expect(store.withActiveAccount(randomUUID(), work)).rejects.toBeInstanceOf(AuthFailure);
    await store.suspend(id, true);
    await expect(store.withActiveAccount(id, work)).rejects.toBeInstanceOf(AuthFailure);
    await store.suspend(id, false);
    expect(await store.deleteAccount(id, proof)).toBe(true);
    await expect(store.withActiveAccount(id, work)).rejects.toBeInstanceOf(AuthFailure);
    expect(work).not.toHaveBeenCalled();
    expect(await db.query('select * from identity_lifecycle_fixture')).toEqual([]);
  });

  it('rolls back failed consumer work and never calls cleanup for invalid deletion proof', async () => {
    await expect(
      store.withActiveAccount(id, async (tx) => {
        await write(tx);
        throw new Error('consumer failed');
      }),
    ).rejects.toThrow('consumer failed');
    expect(await db.query('select * from identity_lifecycle_fixture')).toEqual([]);
    const cleanup = vi.fn();
    expect(
      await new PostgresAccountStore(db, cleanup).deleteAccount(id, {
        ...proof,
        expectedHash: 'stale',
      }),
    ).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('rolls back cleanup and identity state if the participant fails', async () => {
    await store.withActiveAccount(id, write);
    const failure = new Error('cleanup failed');
    const failing = new PostgresAccountStore(db, async (owner, tx) => {
      await erase(owner, tx);
      throw failure;
    });
    await expect(failing.deleteAccount(id, proof)).rejects.toBe(failure);
    expect(await store.canSpend(id)).toBe(true);
    expect((await store.getPasswordAccount(id))?.passwordHash).toBe(proof.expectedHash);
    expect(await db.query('select * from identity_lifecycle_fixture')).toHaveLength(1);
  });

  it('rolls back successful cleanup if a later identity write fails', async () => {
    await store.withActiveAccount(id, write);
    const failing: IdentityDatabase = {
      query: (text, values) => db.query(text, values),
      withTransaction: (work) =>
        db.withTransaction((tx) =>
          work({
            query: (text, values) =>
              text.startsWith('delete from auth_sessions')
                ? Promise.reject(new Error('identity failed'))
                : tx.query(text, values),
          }),
        ),
    };
    await expect(new PostgresAccountStore(failing, erase).deleteAccount(id, proof)).rejects.toThrow(
      'identity failed',
    );
    expect(await store.canSpend(id)).toBe(true);
    expect((await store.getPasswordAccount(id))?.passwordHash).toBe(proof.expectedHash);
    expect(await db.query('select * from identity_lifecycle_fixture')).toHaveLength(1);
  });

  async function waitForBlockedConnection(blocker: number): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [row] = await db.query<{ waiting: boolean }>(
        'select exists (select 1 from pg_stat_activity where $1::integer = any(pg_blocking_pids(pid))) as waiting',
        [blocker],
      );
      if (row?.waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Competing connection did not wait on the account lock');
  }

  it('allows overlapping shared reads while suspension waits for both to finish', async () => {
    const locked = signal();
    const finish = signal();
    let blocker = 0;
    const first = store.withActiveAccountRead(id, async (tx) => {
      const [row] = await tx.query<{ pid: number }>('select pg_backend_pid() as pid', []);
      blocker = row!.pid;
      locked.release();
      await finish.promise;
    });
    await locked.promise;
    try {
      // A second shared reader completes while the first still holds its lock.
      expect(await store.withActiveAccountRead(id, () => Promise.resolve('read'))).toBe('read');
      const suspension = store.suspend(id, true);
      try {
        await waitForBlockedConnection(blocker);
      } finally {
        finish.release();
      }
      await first;
      await suspension;
      await expect(
        store.withActiveAccountRead(id, () => Promise.resolve('denied')),
      ).rejects.toBeInstanceOf(AuthFailure);
    } finally {
      finish.release();
      await first;
    }
  });

  it('erases a save that holds the account lock before deletion', async () => {
    const locked = signal();
    const finish = signal();
    let blocker = 0;
    const save = store.withActiveAccount(id, async (tx) => {
      await write(tx);
      const [row] = await tx.query<{ pid: number }>('select pg_backend_pid() as pid', []);
      blocker = row!.pid;
      locked.release();
      await finish.promise;
    });
    await locked.promise;
    const deletion = store.deleteAccount(id, proof);
    try {
      await waitForBlockedConnection(blocker);
    } finally {
      finish.release();
    }
    await save;
    expect(await deletion).toBe(true);
    expect(await db.query('select * from identity_lifecycle_fixture')).toEqual([]);
  });

  it('rejects a save behind deletion rather than resurrecting consumer data', async () => {
    const locked = signal();
    const finish = signal();
    let blocker = 0;
    const deleting = new PostgresAccountStore(db, async (owner, tx) => {
      await erase(owner, tx);
      const [row] = await tx.query<{ pid: number }>('select pg_backend_pid() as pid', []);
      blocker = row!.pid;
      locked.release();
      await finish.promise;
    });
    const deletion = deleting.deleteAccount(id, proof);
    await locked.promise;
    const work = vi.fn(write);
    const save = expect(store.withActiveAccount(id, work)).rejects.toBeInstanceOf(AuthFailure);
    try {
      await waitForBlockedConnection(blocker);
    } finally {
      finish.release();
    }
    expect(await deletion).toBe(true);
    await save;
    expect(work).not.toHaveBeenCalled();
    expect(await db.query('select * from identity_lifecycle_fixture')).toEqual([]);
  });
});
