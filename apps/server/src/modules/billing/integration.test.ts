import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { createBillingSlice } from './index.js';

describe.skipIf(!TEST_DATABASE_URL)('billing: worker to wallet', () => {
  let db: Db;
  let drop: () => Promise<void>;
  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
  });
  afterAll(async () => {
    await drop?.();
  });

  it('records every delegated cost and shows the same total in wallet and tree', async () => {
    const billing = createBillingSlice({ db });
    const session = createSessionSlice({ db, broker: new Broker(), recordSpend: billing.record });
    const snapshot = await session.kernel.start('project', 'owner', 'research');
    await session.kernel.idle();
    const after = await session.kernel.snapshot(snapshot.session.id, {
      accountId: 'owner',
      role: 'user',
    });
    expect(after.tasks).toHaveLength(4);
    expect(after.spend.dollars).toBeCloseTo(0.03, 6);
    expect((await billing.monthSpend('owner')).spent.dollars).toBe(0.03);
    expect((await billing.monthSpend('other')).spent.dollars).toBe(0);
    const restored = createBillingSlice({ db });
    expect((await restored.monthSpend('owner')).spent.dollars).toBe(0.03);
  });

  it('rolls back the task cost and ledger when the transaction fails', async () => {
    const billing = createBillingSlice({ db });
    const session = createSessionSlice({
      db,
      broker: new Broker(),
      worker: { run: () => Promise.resolve() },
      recordSpend: async (entry, tx) => {
        await billing.record(entry, tx);
        throw new Error('write failed');
      },
    });
    const snapshot = await session.kernel.start('project', 'failed-owner', 'research');
    await session.kernel.idle();
    const taskId = snapshot.tasks[0]!.id;
    await expect(session.kernel.addSpend(taskId, { dollars: 1 }, 'test')).rejects.toThrow(
      'write failed',
    );
    expect((await billing.monthSpend('failed-owner')).spent.dollars).toBe(0);
    expect(
      (
        await session.kernel.snapshot(snapshot.session.id, {
          accountId: 'failed-owner',
          role: 'user',
        })
      ).spend.dollars,
    ).toBe(0);
  });
});
