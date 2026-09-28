import { describe, expect, it, vi } from 'vitest';
import {
  AccountHandler,
  ApprovalHandler,
  BudgetChain,
  MonthlyCapHandler,
  type BudgetHandler,
} from './budgetChain.js';
import { createBillingSlice } from './index.js';
import type { BudgetGuard, Charge, Decision } from '../../core/domain/budget.js';

const charge: Charge = {
  accountId: 'alice',
  taskId: '00000000-0000-4000-8000-000000000001',
  estimate: { dollars: 0.2 },
  at: 'turn',
  reason: 'reader turn',
};

describe('billing: budget responsibility chain', () => {
  it('visits handlers in order and stops at the first decision', async () => {
    const calls: number[] = [];
    const handler = (n: number, decision: Decision | null): BudgetHandler => ({
      handle: () => {
        calls.push(n);
        return Promise.resolve(decision);
      },
    });
    const chain = new BudgetChain([
      handler(1, null),
      handler(2, { kind: 'allow' }),
      handler(3, { kind: 'deny', reason: 'unreachable' }),
    ]);
    expect(await chain.check(charge)).toEqual({ kind: 'allow' });
    expect(calls).toEqual([1, 2]);
  });

  it('denies an ineligible account before querying its balance', async () => {
    const fits = vi.fn(() => Promise.resolve(true));
    const chain = new BudgetChain([
      new AccountHandler(() => Promise.resolve(false)),
      new MonthlyCapHandler(fits),
      new ApprovalHandler(),
    ]);
    expect(await chain.check(charge)).toEqual({ kind: 'deny', reason: 'account cannot spend' });
    expect(fits).not.toHaveBeenCalled();
  });

  it.each(['turn', 'fan-out', 'task-open'] as const)('allows within the cap at %s', async (at) => {
    const fits = vi.fn(() => Promise.resolve(true));
    const chain = new BudgetChain([
      new AccountHandler(() => Promise.resolve(true)),
      new MonthlyCapHandler(fits),
      new ApprovalHandler(),
    ]);
    expect(await chain.check({ ...charge, at })).toEqual({ kind: 'allow' });
    expect(fits).toHaveBeenCalledWith(charge.accountId, charge.estimate);
  });

  it('falls through the cap check to the Sprint 2 denial', async () => {
    const chain = new BudgetChain([
      new AccountHandler(() => Promise.resolve(true)),
      new MonthlyCapHandler(() => Promise.resolve(false)),
      new ApprovalHandler(),
    ]);
    expect(await chain.check(charge)).toEqual({ kind: 'deny', reason: 'over the cap' });
  });

  it('adds a fourth policy without changing a BudgetGuard caller', async () => {
    const caller = (guard: BudgetGuard): Promise<Decision> => guard.check(charge);
    const policies: BudgetHandler[] = [
      new AccountHandler(() => Promise.resolve(true)),
      new MonthlyCapHandler(() => Promise.resolve(false)),
      new ApprovalHandler(),
    ];
    expect(await caller(new BudgetChain(policies))).toEqual({
      kind: 'deny',
      reason: 'over the cap',
    });
    const fourth: BudgetHandler = {
      handle: () => Promise.resolve({ kind: 'escalate', approvalId: 'test-only-approval' }),
    };
    policies.splice(2, 0, fourth);
    expect(await caller(new BudgetChain(policies))).toEqual({
      kind: 'escalate',
      approvalId: 'test-only-approval',
    });
  });

  it('denies if every handler passes or the chain is empty', async () => {
    for (const handlers of [[], [{ handle: () => Promise.resolve(null) }]]) {
      expect(await new BudgetChain(handlers).check(charge)).toMatchObject({ kind: 'deny' });
    }
  });

  it.each(['account', 'cap'])(
    'propagates a %s store failure instead of allowing',
    async (store) => {
      const error = new Error('store unavailable');
      const fail = (): Promise<boolean> => Promise.reject(error);
      const chain = new BudgetChain([
        new AccountHandler(store === 'account' ? fail : () => Promise.resolve(true)),
        new MonthlyCapHandler(store === 'cap' ? fail : () => Promise.resolve(true)),
        new ApprovalHandler(),
      ]);
      await expect(chain.check(charge)).rejects.toBe(error);
    },
  );

  it('rejects invalid estimates before a permissive policy can allow them', async () => {
    const handler = { handle: vi.fn((): Promise<Decision> => Promise.resolve({ kind: 'allow' })) };
    await expect(
      new BudgetChain([handler]).check({ ...charge, estimate: { dollars: -1 } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('fails closed until an account eligibility provider is wired', async () => {
    const billing = createBillingSlice({ db: null });
    expect(await billing.budgetGuard.check(charge)).toEqual({
      kind: 'deny',
      reason: 'account cannot spend',
    });
    const configured = createBillingSlice({ db: null, canSpend: () => Promise.resolve(true) });
    await expect(configured.budgetGuard.check(charge)).rejects.toMatchObject({ status: 503 });
  });
});
