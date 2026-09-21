import type { Money } from '@lumen/contracts';

// Local until the core owner publishes core/domain/budget.ts.
export interface Charge {
  readonly accountId: string;
  readonly taskId: string;
  readonly estimate: Money;
  readonly at: 'turn' | 'fan-out' | 'task-open';
  readonly reason: string;
}
export type Decision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'escalate'; readonly approvalId: string }
  | { readonly kind: 'deny'; readonly reason: string };
export interface BudgetGuard {
  check(charge: Charge): Promise<Decision>;
}
export interface Spend {
  readonly accountId: string;
  readonly taskId: string;
  readonly amount: Money;
  readonly reason: string;
}
export interface WalletSummary {
  readonly spent: Money;
  readonly cap: Money;
}
