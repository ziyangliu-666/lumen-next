import type { Money } from '@lumen/contracts';

// The seam between the kernel (session slice) and the spend policy (billing
// slice). The kernel asks before it spends; billing answers. It lives here so
// that neither slice imports the other: session knows a BudgetGuard, billing
// implements one, and main.ts introduces them.

/** Where in a session the kernel is asking. A new check point adds a name here and one call. */
export type CheckPoint = 'turn' | 'fan-out' | 'task-open';

export interface Charge {
  /** Who pays. Always the account that opened the session, never a value from the browser. */
  readonly accountId: string;
  readonly taskId: string;
  /**
   * What the work is expected to cost. Zero means "unknown": the question is
   * then only whether this account may spend at all and still has room.
   */
  readonly estimate: Money;
  readonly at: CheckPoint;
  readonly reason: string;
}

export type Decision =
  | { readonly kind: 'allow' }
  /** Over the cap, and the user may approve it. The task waits for the answer. */
  | { readonly kind: 'escalate'; readonly approvalId: string }
  | { readonly kind: 'deny'; readonly reason: string };

export interface BudgetGuard {
  /**
   * A thrown error is not a decision. The kernel treats it as "could not ask",
   * and does not run the work: a guard that is down must never read as allow.
   */
  check(charge: Charge): Promise<Decision>;
}

/**
 * The guard for a process with no billing slice, and for tests of everything
 * that is not about budgets. It is named for what it does so that nobody wires
 * it into production by accident.
 */
export const allowEverything: BudgetGuard = {
  check: () => Promise.resolve({ kind: 'allow' }),
};
