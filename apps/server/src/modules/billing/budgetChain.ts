import type { Money } from '@lumen/contracts';
import type { BudgetGuard, Charge, Decision } from './ports.js';
import { money } from './validation.js';

/** null delegates to the next policy; a decision ends the chain. */
export interface BudgetHandler {
  handle(charge: Charge): Promise<Decision | null>;
}

export class BudgetChain implements BudgetGuard {
  private readonly handlers: readonly BudgetHandler[];

  constructor(handlers: readonly BudgetHandler[]) {
    this.handlers = [...handlers];
  }

  async check(charge: Charge): Promise<Decision> {
    money(charge.estimate);
    for (const handler of this.handlers) {
      const decision = await handler.handle(charge);
      if (decision !== null) return decision;
    }
    return { kind: 'deny', reason: 'no budget policy accepted the charge' };
  }
}

export class AccountHandler implements BudgetHandler {
  constructor(private readonly canSpend: (accountId: string) => Promise<boolean>) {}

  async handle(charge: Charge): Promise<Decision | null> {
    if (!charge.accountId.trim() || !(await this.canSpend(charge.accountId)))
      return { kind: 'deny', reason: 'account cannot spend' };
    return null;
  }
}

export class MonthlyCapHandler implements BudgetHandler {
  constructor(private readonly fits: (accountId: string, estimate: Money) => Promise<boolean>) {}

  async handle(charge: Charge): Promise<Decision | null> {
    return (await this.fits(charge.accountId, charge.estimate)) ? { kind: 'allow' } : null;
  }
}

/** Sprint 2 terminal policy. Durable approval is a separate Sprint 3 story. */
export class ApprovalHandler implements BudgetHandler {
  handle(): Promise<Decision> {
    return Promise.resolve({ kind: 'deny', reason: 'over the cap' });
  }
}
