import type { Money } from '@lumen/contracts';
import type { Db } from '../../core/db/db.js';
import { badRequest, HttpError } from '../../core/http/httpError.js';
import { UUID } from './validation.js';

export interface TopupOrder {
  readonly id: string;
  readonly accountId: string;
}
export interface PaidTopup {
  readonly orderId: string;
  readonly checkoutId: string;
  readonly paymentId: string;
  /** Stripe's integer cents, carried as text; SQL converts and compares money. */
  readonly cents: string;
}
export interface TopupProvider {
  checkout(order: TopupOrder): Promise<{ id: string; url: string }>;
  /** Verify the signature over raw bytes before parsing. Return only a paid USD
   * test-mode Checkout payment bound to our persisted order; ignore other events.
   */
  paidEvent(body: Buffer, signature: string): PaidTopup | null;
}
export interface TopupReceipt {
  readonly id: string;
  readonly amount: Money;
  readonly paidAt: string;
}

/** Purchased credit is recorded separately from expenses and the editable cap. */
export class Topups {
  constructor(private readonly db: Db) {}

  async order(accountId: string, requestId: string): Promise<TopupOrder> {
    if (!UUID.test(requestId)) throw badRequest('invalid checkout request');
    const [row] = await this.db.query<{ id: string; usable: boolean }>(
      `insert into billing_topups (account_id, request_id, amount)
       values ($1, $2, 5.000000::numeric)
       on conflict (account_id, request_id) do update set request_id = excluded.request_id
       returning id, paid_at is null and created_at > now() - interval '23 hours' as usable`,
      [accountId, requestId],
    );
    if (!row!.usable) throw new HttpError(409, 'start a new checkout request');
    return { id: row!.id, accountId };
  }

  async attach(orderId: string, checkoutId: string): Promise<void> {
    const rows = await this.db.query(
      `update billing_topups set checkout_id = $2 where id = $1
       and (checkout_id is null or checkout_id = $2) returning id`,
      [orderId, checkoutId],
    );
    if (!rows.length) throw new HttpError(409, 'checkout does not match the order');
  }

  async credit(payment: PaidTopup): Promise<void> {
    if (!UUID.test(payment.orderId) || !/^\d+$/.test(payment.cents))
      throw badRequest('invalid payment reference');
    await this.db.withTransaction(async (tx) => {
      const [row] = await tx.query<{ matches: boolean; paid: boolean }>(
        `select amount = $2::numeric / 100::numeric
           and (checkout_id is null or checkout_id = $3)
           and (payment_id is null or payment_id = $4) as matches,
           paid_at is not null as paid
         from billing_topups where id = $1 for update`,
        [payment.orderId, payment.cents, payment.checkoutId, payment.paymentId],
      );
      if (!row || !row.matches) throw badRequest('payment does not match the order');
      if (row.paid) return;
      // #52: top-ups raise the flat cap; the default remains in the store.
      // Both writes commit together. An explicitly saved zero is preserved.
      await tx.query(
        `insert into billing_wallets (account_id, cap)
         select account_id, 1.000000::numeric + amount from billing_topups where id = $1
         on conflict (account_id) do update set cap = billing_wallets.cap +
           (select amount from billing_topups where id = $1)`,
        [payment.orderId],
      );
      await tx.query(
        `update billing_topups set checkout_id = $2, payment_id = $3, paid_at = now()
         where id = $1`,
        [payment.orderId, payment.checkoutId, payment.paymentId],
      );
    });
  }

  async receipts(accountId: string): Promise<readonly TopupReceipt[]> {
    const rows = await this.db.query<{ id: string; amount: number; paid_at: Date }>(
      `select id, amount, paid_at from billing_topups where account_id = $1
       and paid_at is not null order by paid_at desc, id desc limit 100`,
      [accountId],
    );
    return rows.map((row) => ({
      id: row.id,
      amount: { dollars: row.amount },
      paidAt: row.paid_at.toISOString(),
    }));
  }
}
