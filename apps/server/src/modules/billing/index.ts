import type { StaffAccountChanges } from '../identity/index.js';
import { Secrets } from './secrets.js';
import type { SecretCipher } from './secretCipher.js';
import type { WithActiveSecretAccount } from './secretLifecycle.js';
import { keyRoutes } from './keyRoutes.js';
// Public index for the billing slice.
import type { FastifyInstance } from 'fastify';
import type { Db, Queryable } from '../../core/db/db.js';
import { HttpError } from '../../core/http/httpError.js';
import { nullLog, type Log } from '../../core/log/log.js';
import { withBudgetLog } from './budgetLog.js';
import { Ledger } from './ledger.js';
import { Topups, type TopupProvider } from './topups.js';
import { topupRoutes } from './topupRoutes.js';
export type { TopupProvider, TopupOrder, PaidTopup } from './topups.js';
import { adminRoutes, type AdminAccountReader } from './adminRoutes.js';
import { adminLedgerRoutes } from './adminLedger.js';
import { adminWalletRoutes } from './adminWallet.js';
export type { AdminAccountReader } from './adminRoutes.js';
import { Approvals } from './approvals.js';
import { approvalRoutes } from './approvalRoutes.js';
export type { Approval } from './approvals.js';
import type { BudgetApprovalResume, BudgetGuard, Charge } from '../../core/domain/budget.js';
import type { Spend, WalletSummary } from './ports.js';
import { walletRoutes } from './routes.js';
import { AccountHandler, ApprovalHandler, BudgetChain, MonthlyCapHandler } from './budgetChain.js';

export type { BudgetGuard, Charge, CheckPoint, Decision } from '../../core/domain/budget.js';
export type { Spend, WalletSummary } from './ports.js';
export type { LedgerEntry, LedgerPage } from './ledger.js';
export { BudgetChain, AccountHandler, MonthlyCapHandler, ApprovalHandler } from './budgetChain.js';
export type { BudgetHandler } from './budgetChain.js';

export interface BillingSlice {
  readonly secret?: (accountId: string, provider: string) => Promise<string | null>;
  readonly registerRoutes: (app: FastifyInstance) => void;
  /** Optional transaction lets session persist trace cost and ledger together. */
  readonly record: (entry: Spend, tx?: Queryable) => Promise<void>;
  /** Historical name: all-time account spend and flat cap, with no monthly reset. */
  readonly monthSpend: (accountId: string) => Promise<WalletSummary>;
  readonly budgetGuard: BudgetGuard;
}

export function createBillingSlice(deps: {
  db: Db | null;
  keys?: {
    cipher: SecretCipher;
    write: WithActiveSecretAccount;
    read: WithActiveSecretAccount;
    remove: (accountId: string) => Promise<void>;
  };
  log?: Log;
  topups?: TopupProvider;
  approvalResume?: BudgetApprovalResume;
  origin?: string;
  /** Identity-owned public read API; billing authorizes staff before calling it. */
  adminAccounts?: AdminAccountReader;
  adminChanges?: StaffAccountChanges;
  /** Identity supplies eligibility through its public API when guard wiring lands. */
  canSpend?: (accountId: string) => Promise<boolean>;
}): BillingSlice {
  if (deps.keys && (!deps.db || !deps.origin))
    throw new Error('Keys require a database, identity lifecycle and origin');
  const secrets = deps.keys ? new Secrets(deps.keys.cipher, deps.keys.write, deps.keys.read) : null;
  const log = (deps.log ?? nullLog).child({ slice: 'billing' });
  const approvals =
    deps.db && deps.approvalResume ? new Approvals(deps.db, deps.approvalResume) : null;
  const ledger = deps.db ? new Ledger(deps.db) : null;
  const required = (): Ledger => {
    if (!ledger) throw new HttpError(503, 'wallet requires a database');
    return ledger;
  };
  return {
    ...(secrets ? { secret: (id: string, provider: string) => secrets.secret(id, provider) } : {}),
    monthSpend: (accountId) => required().monthSpend(accountId),
    record: (entry, tx) => required().record(entry, tx),
    budgetGuard: withBudgetLog(
      new BudgetChain([
        new AccountHandler(deps.canSpend ?? (() => Promise.resolve(false))),
        ...(approvals
          ? [
              {
                handle: (charge: Charge) => approvals.check(charge),
              },
            ]
          : []),
        new MonthlyCapHandler((accountId, estimate) => required().fits(accountId, estimate)),
        new ApprovalHandler(approvals ? (charge) => approvals.request(charge) : undefined),
      ]),
      log,
    ),
    registerRoutes: (app) => {
      if (secrets && deps.keys && deps.origin)
        void app.register((scope, _options, done) => {
          keyRoutes(secrets, deps.origin!, deps.keys!.remove)(scope);
          done();
        });
      walletRoutes(ledger)(app);
      topupRoutes(
        deps.db ? new Topups(deps.db) : null,
        deps.topups,
        deps.origin,
        deps.canSpend ?? (() => Promise.resolve(false)),
      )(app);
      adminRoutes(deps.adminAccounts, deps.adminChanges, deps.origin)(app);
      adminLedgerRoutes(deps.db, deps.adminAccounts)(app);
      adminWalletRoutes(ledger, deps.adminAccounts)(app);
      approvalRoutes(approvals, deps.origin, deps.canSpend ?? (() => Promise.resolve(false)))(app);
    },
  };
}

export { stripeFromEnvironment, StripeTopups } from './stripe.js';
export type { StripeConfiguration } from './stripe.js';

// Startup validation is available before the Keys storage activation gate opens.
export { secretCipherFromEnvironment } from './secretConfiguration.js';

export { eraseAccountSecrets, removeOwnOpenAiKey } from './secretLifecycle.js';
export type { WithActiveSecretAccount } from './secretLifecycle.js';

export type { SecretCipher } from './secretCipher.js';
