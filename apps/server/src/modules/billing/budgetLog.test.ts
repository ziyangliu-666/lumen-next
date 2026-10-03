import { expect, it, vi } from 'vitest';
import type { Charge, Decision } from '../../core/domain/budget.js';
import { capture } from '../../core/log/testLog.js';
import { withBudgetLog } from './budgetLog.js';
import { createBillingSlice } from './index.js';

const charge: Charge = {
  accountId: 'account-id',
  taskId: 'task-id',
  attemptId: 'attempt-id',
  at: 'turn',
  estimate: { dollars: 0.1 },
  reason: 'private prompt, card, key, webhook body and person@example.test',
};

it.each(['turn', 'fan-out', 'task-open'] as const)(
  'logs a denial at %s through the injected slice logger',
  async (at) => {
    const { log, lines } = capture();
    const billing = createBillingSlice({ db: null, log });
    expect(await billing.budgetGuard.check({ ...charge, at })).toEqual({
      kind: 'deny',
      reason: 'account cannot spend',
    });
    expect(lines()).toHaveLength(1);
    const { pid: _pid, hostname: _host, time: _time, ...line } = lines()[0]!;
    expect(line).toEqual({
      level: 40,
      slice: 'billing',
      msg: 'budget check refused',
      checkpoint: at,
      accountId: charge.accountId,
      taskId: charge.taskId,
      attemptId: charge.attemptId,
      decision: 'deny',
      reason: 'account cannot spend',
    });
    expect(JSON.stringify(lines())).not.toContain(charge.reason);
  },
);

it.each([
  { kind: 'deny', reason: 'over the cap' },
  { kind: 'deny', reason: 'approval rejected' },
  { kind: 'deny', reason: 'approval does not match this operation' },
  { kind: 'escalate', approvalId: 'approval-id' },
] satisfies Decision[])(
  'keeps a $kind decision and checks the underlying guard exactly once',
  async (decision) => {
    const { log, lines } = capture();
    const check = vi.fn().mockResolvedValue(decision);
    const guard = withBudgetLog({ check }, log);
    expect(await guard.check(charge)).toBe(decision);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(charge);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({
      level: 40,
      decision: decision.kind,
      reason: decision.kind === 'deny' ? decision.reason : 'approval required',
      ...(decision.kind === 'escalate' ? { approvalId: decision.approvalId } : {}),
    });
    expect(JSON.stringify(lines())).not.toContain(charge.reason);
  },
);

it('does not turn an allow or a thrown storage error into a logged refusal', async () => {
  const { log, lines } = capture();
  const allow: Decision = { kind: 'allow' };
  expect(await withBudgetLog({ check: () => Promise.resolve(allow) }, log).check(charge)).toBe(
    allow,
  );
  const failure = new Error('private database connection details');
  await expect(
    withBudgetLog({ check: () => Promise.reject(failure) }, log).check(charge),
  ).rejects.toBe(failure);
  expect(lines()).toEqual([]);
});
