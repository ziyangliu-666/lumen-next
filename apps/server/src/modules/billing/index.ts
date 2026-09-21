// Public index for the billing slice. Owner: HE RONG.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../core/db/db.js';
import { requireUser } from '../../core/http/authGuard.js';
import type { BudgetGuard, Spend, WalletSummary } from './ports.js';

export type { BudgetGuard, Charge, Decision, Spend, WalletSummary } from './ports.js';

export interface BillingSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly record: (entry: Spend) => Promise<void>;
  readonly monthSpend: (accountId: string) => Promise<WalletSummary>;
  readonly budgetGuard: BudgetGuard;
}

/** Initial shell. Ledger persistence and the budget handlers follow separately. */
export function createBillingSlice(_deps: { db: Db | null }): BillingSlice {
  const monthSpend = (_accountId: string): Promise<WalletSummary> =>
    Promise.resolve({ spent: { dollars: 0 }, cap: { dollars: 0 } });
  return {
    monthSpend,
    record: () => Promise.reject(new Error('billing ledger is not configured')),
    budgetGuard: {
      check: () => Promise.resolve({ kind: 'deny', reason: 'billing guard is not configured' }),
    },
    registerRoutes: (app) => {
      app.get('/api/wallet', (request) => monthSpend(requireUser(request).accountId));
    },
  };
}
