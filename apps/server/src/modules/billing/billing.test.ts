import { describe, expect, it } from 'vitest';
import type { Charge } from './index.js';
import { ApprovalGuard, CapGuard } from './index.js';

const charge = (amount: number, spent: number): Charge => ({
  amount: { cents: amount },
  spentThisMonth: { cents: spent },
  monthlyCap: { cents: 20000 },
  approvalThreshold: { cents: 3000 },
});

describe('billing: Chain of Responsibility', () => {
  const chain = new ApprovalGuard();
  chain.setNext(new CapGuard());

  it('allows an ordinary charge', () => {
    expect(chain.handle(charge(100, 0)).verdict).toBe('allow');
  });

  it('escalates a single step over the approval threshold', () => {
    const d = chain.handle(charge(3400, 0));
    expect(d.verdict).toBe('escalate');
  });

  it('denies a charge that would cross the monthly cap', () => {
    const d = chain.handle(charge(500, 19800));
    expect(d.verdict).toBe('deny');
  });

  it.todo('an escalate verdict raises an approval request the user answers on the wallet page');
});
