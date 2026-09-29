// Public index for the billing slice. Owner: HE RONG.
import type { FastifyInstance } from 'fastify';
import type { Db, Queryable } from '../../core/db/db.js';
import { HttpError } from '../../core/http/httpError.js';
import { Ledger } from './ledger.js';
import { adminRoutes, type AdminAccountReader } from './adminRoutes.js';
export type { AdminAccountReader } from './adminRoutes.js';
import type { BudgetGuard } from '../../core/domain/budget.js';
import type { Spend, WalletSummary } from './ports.js';
import { walletRoutes } from './routes.js';
import { AccountHandler, ApprovalHandler, BudgetChain, MonthlyCapHandler } from './budgetChain.js';

export type { BudgetGuard, Charge, CheckPoint, Decision } from '../../core/domain/budget.js';
export type { Spend, WalletSummary } from './ports.js';
export type { LedgerEntry, LedgerPage } from './ledger.js';
export { BudgetChain, AccountHandler, MonthlyCapHandler, ApprovalHandler } from './budgetChain.js';
export type { BudgetHandler } from './budgetChain.js';

export interface BillingSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  /** Optional transaction lets session persist trace cost and ledger together. */
  readonly record: (entry: Spend, tx?: Queryable) => Promise<void>;
  /** Historical name: all-time account spend and flat cap, with no monthly reset. */
  readonly monthSpend: (accountId: string) => Promise<WalletSummary>;
  readonly budgetGuard: BudgetGuard;
}

export function createBillingSlice(deps: {
  db: Db | null;
  /** Identity-owned public read API; billing authorizes staff before calling it. */
  adminAccounts?: AdminAccountReader;
  /** Identity supplies eligibility through its public API when guard wiring lands. */
  canSpend?: (accountId: string) => Promise<boolean>;
}): BillingSlice {
  const ledger = deps.db ? new Ledger(deps.db) : null;
  const required = (): Ledger => {
    if (!ledger) throw new HttpError(503, 'wallet requires a database');
    return ledger;
  };
  return {
    monthSpend: (accountId) => required().monthSpend(accountId),
    record: (entry, tx) => required().record(entry, tx),
    budgetGuard: new BudgetChain([
      new AccountHandler(deps.canSpend ?? (() => Promise.resolve(false))),
      new MonthlyCapHandler((accountId, estimate) => required().fits(accountId, estimate)),
      new ApprovalHandler(),
    ]),
    registerRoutes: (app) => {
      walletRoutes(ledger)(app);
      adminRoutes(deps.adminAccounts)(app);
    },
  };
}
