import type { BudgetGuard } from '../../core/domain/budget.js';
import type { Log } from '../../core/log/log.js';

/** Observe the decision without changing policy order, approval use or failures. */
export function withBudgetLog(guard: BudgetGuard, log: Log): BudgetGuard {
  return {
    async check(charge) {
      const decision = await guard.check(charge);
      if (decision.kind !== 'allow') {
        log.warn(
          {
            checkpoint: charge.at,
            accountId: charge.accountId,
            taskId: charge.taskId,
            attemptId: charge.attemptId,
            decision: decision.kind,
            // These are billing policy reasons, never the caller's free-text Charge.reason.
            reason: decision.kind === 'deny' ? decision.reason : 'approval required',
            ...(decision.kind === 'escalate' ? { approvalId: decision.approvalId } : {}),
          },
          'budget check refused',
        );
      }
      return decision;
    },
  };
}
