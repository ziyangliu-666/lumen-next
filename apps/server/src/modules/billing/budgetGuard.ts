import type { Money } from '@lumen/contracts';

// Chain of Responsibility. The spend cap is checked at three points in a run.
// Each guard either passes the request along, escalates it to the user for
// approval, or denies it. A new check point is a new link, and the callers do
// not change.
export type Decision =
  | { verdict: 'allow' }
  | { verdict: 'escalate'; reason: string }
  | { verdict: 'deny'; reason: string };

export interface Charge {
  readonly amount: Money;
  readonly spentThisMonth: Money;
  readonly monthlyCap: Money;
  /** A single step above this needs explicit user approval. */
  readonly approvalThreshold: Money;
}

export abstract class BudgetGuard {
  private next: BudgetGuard | null = null;

  setNext(guard: BudgetGuard): BudgetGuard {
    this.next = guard;
    return guard;
  }

  handle(charge: Charge): Decision {
    const local = this.check(charge);
    if (local) return local;
    return this.next ? this.next.handle(charge) : { verdict: 'allow' };
  }

  protected abstract check(charge: Charge): Decision | null;
}

export class CapGuard extends BudgetGuard {
  protected check(charge: Charge): Decision | null {
    const after = charge.spentThisMonth.cents + charge.amount.cents;
    if (after > charge.monthlyCap.cents) {
      return { verdict: 'deny', reason: 'monthly cap reached' };
    }
    return null;
  }
}

export class ApprovalGuard extends BudgetGuard {
  protected check(charge: Charge): Decision | null {
    if (charge.amount.cents > charge.approvalThreshold.cents) {
      return { verdict: 'escalate', reason: 'single step over the approval threshold' };
    }
    return null;
  }
}
