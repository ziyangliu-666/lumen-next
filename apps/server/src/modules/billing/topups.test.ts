import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { Ledger } from './ledger.js';
import { Topups, type PaidTopup } from './topups.js';

describe.skipIf(!TEST_DATABASE_URL)('durable top-up accounting', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let store: Topups;
  let ledger: Ledger;
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    store = new Topups(db);
    ledger = new Ledger(db);
  });
  afterEach(async () => {
    await drop?.();
  });
  async function payment(accountId = 'alice'): Promise<PaidTopup> {
    const order = await store.order(accountId, randomUUID());
    return {
      orderId: order.id,
      checkoutId: `cs_test_${order.id}`,
      paymentId: `pi_${order.id}`,
      cents: '500',
    };
  }
  it('credits once across simultaneous deliveries and a recreated store, without changing spend', async () => {
    const paid = await payment();
    await Promise.all([store.credit(paid), new Topups(db).credit(paid)]);
    await new Topups(db).credit(paid);
    expect(await ledger.monthSpend('alice')).toEqual({
      spent: { dollars: 0 },
      cap: { dollars: 6 },
    });
    expect(await store.receipts('alice')).toHaveLength(1);
    expect(await store.receipts('bob')).toEqual([]);
    expect(await ledger.fits('alice', { dollars: 6 })).toBe(true);
    expect(await ledger.fits('alice', { dollars: 6.000001 })).toBe(false);
  });
  it('uses the stored cap including zero and adds concurrent purchases with SQL numeric', async () => {
    await ledger.setCap('alice', { dollars: 0 });
    const first = await payment();
    await store.attach(first.orderId, first.checkoutId);
    await store.credit(first);
    expect((await ledger.monthSpend('alice')).cap.dollars).toBe(5);
    await ledger.setCap('alice', { dollars: 0.123456 });
    const payments = await Promise.all([payment(), payment()]);
    await Promise.all(payments.map((paid) => store.credit(paid)));
    expect((await ledger.monthSpend('alice')).cap.dollars).toBe(10.123456);
  });
  it('rejects mismatched amounts, checkout IDs and repeated payment IDs with atomic rollback', async () => {
    const first = await payment();
    await store.attach(first.orderId, first.checkoutId);
    await expect(store.credit({ ...first, cents: '501' })).rejects.toMatchObject({ status: 400 });
    await expect(store.credit({ ...first, checkoutId: 'wrong' })).rejects.toMatchObject({
      status: 400,
    });
    await store.credit(first);
    const second = await payment('bob');
    await expect(store.credit({ ...second, paymentId: first.paymentId })).rejects.toThrow();
    expect((await ledger.monthSpend('bob')).cap.dollars).toBe(1);
    expect(await store.receipts('bob')).toEqual([]);
    await expect(store.credit({ ...first, paymentId: 'other' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(store.credit({ ...first, orderId: randomUUID() })).rejects.toMatchObject({
      status: 400,
    });
    await expect(store.credit({ ...first, cents: '5.00' })).rejects.toMatchObject({ status: 400 });
  });
  it('binds checkout retries to the owner, rejects stale and paid orders, and persists before delivery', async () => {
    const requestId = randomUUID();
    const order = await store.order('alice', requestId);
    expect(await new Topups(db).order('alice', requestId)).toEqual(order);
    expect((await store.order('bob', requestId)).id).not.toBe(order.id);
    await store.attach(order.id, 'cs_test_one');
    await store.attach(order.id, 'cs_test_one');
    await expect(store.attach(order.id, 'cs_test_two')).rejects.toMatchObject({ status: 409 });
    await store.credit({
      orderId: order.id,
      checkoutId: 'cs_test_one',
      paymentId: 'pi_one',
      cents: '500',
    });
    await expect(store.order('alice', requestId)).rejects.toMatchObject({ status: 409 });
    await db.query(
      "update billing_topups set created_at = now() - interval '24 hours' where account_id = 'bob'",
    );
    await expect(store.order('bob', requestId)).rejects.toMatchObject({ status: 409 });
    await expect(store.order('alice', 'bad')).rejects.toMatchObject({ status: 400 });
  });
});
