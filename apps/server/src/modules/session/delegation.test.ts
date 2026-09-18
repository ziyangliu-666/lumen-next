import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import { makeTask } from '../../core/domain/task.js';
import { Delegation, DelegationRefused } from './delegation.js';

const running = (depth: number): Task => ({
  ...makeTask('t', 's', null, 'lead', '', depth),
  status: 'running' as const,
});
const work = [{ agent: 'reader', title: 'part' }];

describe('session: delegation', () => {
  it('lets a running task delegate while the child stays inside the depth limit', () => {
    const delegation = new Delegation({ maxDepth: 2, maxParallel: 3 });

    expect(() => delegation.check(running(0), work)).not.toThrow();
    expect(() => delegation.check(running(1), work)).not.toThrow();
  });

  it('refuses a child that would sit deeper than the limit', () => {
    const delegation = new Delegation({ maxDepth: 2, maxParallel: 3 });

    expect(() => delegation.check(running(2), work)).toThrow(DelegationRefused);
  });

  it('refuses a parent that is not running, so a stopped task grows no children', () => {
    const stopped: Task = { ...running(0), status: 'stopped' };

    expect(() => new Delegation().check(stopped, work)).toThrow(/stopped, not running/);
  });

  it('refuses an empty fan-out', () => {
    expect(() => new Delegation().check(running(0), [])).toThrow(/nothing to delegate/);
  });

  it('never runs more jobs at once than maxParallel, and keeps the order of the results', async () => {
    const delegation = new Delegation({ maxDepth: 2, maxParallel: 2 });
    let active = 0;
    let peak = 0;

    const results = await delegation.runBounded([1, 2, 3, 4, 5], async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((done) => setTimeout(done, 5));
      active -= 1;
      return n * 10;
    });

    expect(peak).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });
});
