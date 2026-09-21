// Public index for the billing slice. Owner: HE RONG.
import type { FastifyInstance } from 'fastify';
import type { Db, Queryable } from '../../core/db/db.js';
import { HttpError } from '../../core/http/httpError.js';
import { Ledger } from './ledger.js';
import type { BudgetGuard, Spend, WalletSummary } from './ports.js';
import { walletRoutes } from './routes.js';

export type { BudgetGuard, Charge, Decision, Spend, WalletSummary } from './ports.js';
export type { LedgerEntry, LedgerPage } from './ledger.js';

export interface BillingSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  /** Optional transaction lets session persist trace cost and ledger together. */
  readonly record: (entry: Spend, tx?: Queryable) => Promise<void>;
  readonly monthSpend: (accountId: string) => Promise<WalletSummary>;
  readonly budgetGuard: BudgetGuard;
}

export function createBillingSlice(deps: { db: Db | null }): BillingSlice {
  const ledger = deps.db ? new Ledger(deps.db) : null;
  const required = (): Ledger => {
    if (!ledger) throw new HttpError(503, 'wallet requires a database');
    return ledger;
  };
  return {
    monthSpend: (accountId) => required().monthSpend(accountId),
    record: (entry, tx) => required().record(entry, tx),
    budgetGuard: {
      check: () => Promise.resolve({ kind: 'deny', reason: 'billing guard is not configured' }),
    },
    registerRoutes: walletRoutes(ledger),
  };
}
