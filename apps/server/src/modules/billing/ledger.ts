import type { Money } from '@lumen/contracts';
import type { Db, Queryable } from '../../core/db/db.js';
import { badRequest } from '../../core/http/httpError.js';
import type { Spend, WalletSummary } from './ports.js';
import { cursorId, money, UUID } from './validation.js';

const MONTH_TOTALS = `
      select coalesce((select sum(amount) from ledger_entries
        where account_id = $1
          and created_at >= (date_trunc('month', $2::timestamptz at time zone 'UTC') at time zone 'UTC')
          and created_at < ((date_trunc('month', $2::timestamptz at time zone 'UTC') + interval '1 month') at time zone 'UTC')), 0) as spent,
        coalesce((select cap from billing_wallets where account_id = $1), 0) as cap`;

export interface LedgerEntry {
  readonly id: string;
  readonly taskId: string | null;
  readonly amount: Money;
  readonly reason: string;
  readonly createdAt: string;
}
export interface LedgerPage {
  readonly entries: readonly LedgerEntry[];
  readonly nextCursor: string | null;
}

/** Owns ledger_entries and billing_wallets; reads no other slice's table. */
export class Ledger {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(entry: Spend, tx: Queryable = this.db): Promise<void> {
    money(entry.amount);
    if (
      !entry.accountId.trim() ||
      !UUID.test(entry.taskId) ||
      !entry.reason.trim() ||
      entry.reason.length > 2000
    )
      throw badRequest('invalid ledger entry');
    await tx.query(
      'insert into ledger_entries (account_id, task_id, amount, reason) values ($1, $2, $3, $4)',
      [entry.accountId, entry.taskId, entry.amount.dollars, entry.reason],
    );
  }

  async monthSpend(accountId: string): Promise<WalletSummary> {
    const [row] = await this.db.query<{ spent: number; cap: number }>(MONTH_TOTALS, [
      accountId,
      this.now(),
    ]);
    return { spent: { dollars: row!.spent }, cap: { dollars: row!.cap } };
  }

  /** Both addition and comparison use Postgres numeric, never JS arithmetic. */
  async fits(accountId: string, estimate: Money): Promise<boolean> {
    money(estimate);
    const [row] = await this.db.query<{ fits: boolean }>(
      `select spent + $3::numeric <= cap as fits from (${MONTH_TOTALS}) as wallet`,
      [accountId, this.now(), estimate.dollars],
    );
    return row!.fits;
  }

  async setCap(accountId: string, cap: Money): Promise<void> {
    money(cap);
    await this.db.query(
      `insert into billing_wallets (account_id, cap) values ($1, $2)
      on conflict (account_id) do update set cap = excluded.cap`,
      [accountId, cap.dollars],
    );
  }

  async list(accountId: string, limit: number, cursor?: string): Promise<LedgerPage> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw badRequest('limit must be 1 to 100');
    const id = cursor === undefined ? null : cursorId(cursor);
    const rows = await this.db.query<{
      id: string;
      task_id: string | null;
      amount: number;
      reason: string;
      created_at: Date;
    }>(
      `
      select id, task_id, amount, reason, created_at from ledger_entries
      where account_id = $1 and ($2::uuid is null or (created_at, id) <
        (select created_at, id from ledger_entries where id = $2 and account_id = $1))
      order by created_at desc, id desc limit $3`,
      [accountId, id, limit + 1],
    );
    const shown = rows.slice(0, limit);
    const last = shown.at(-1);
    return {
      entries: shown.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        amount: { dollars: row.amount },
        reason: row.reason,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor: rows.length > limit && last ? Buffer.from(last.id).toString('base64url') : null,
    };
  }
}
