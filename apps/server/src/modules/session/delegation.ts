import type { Task } from '@lumen/contracts';
import type { Delegated } from '../../core/domain/worker.js';

// The two bounds on a fan-out. Depth stops an agent that delegates to an agent
// that delegates, without end; parallelism stops one delegate step from
// starting fifty workers at once. Both are about what one session may cost
// before anybody has looked at it.
export interface DelegationLimits {
  /** The deepest a task may sit. The root is 0, so 2 allows root, child, grandchild. */
  readonly maxDepth: number;
  /** How many children of one fan-out run at the same time. */
  readonly maxParallel: number;
}

export const DEFAULT_LIMITS: DelegationLimits = { maxDepth: 2, maxParallel: 3 };

export class DelegationRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DelegationRefused';
  }
}

export class Delegation {
  constructor(private readonly limits: DelegationLimits = DEFAULT_LIMITS) {}

  /** Throws DelegationRefused when this parent may not hand this work down. */
  check(parent: Task, work: readonly Delegated[]): void {
    if (work.length === 0) throw new DelegationRefused('nothing to delegate');
    if (parent.status !== 'running') {
      // A stopped parent must not grow new children behind the user's back.
      throw new DelegationRefused(`task ${parent.id} is ${parent.status}, not running`);
    }
    if (parent.depth + 1 > this.limits.maxDepth) {
      throw new DelegationRefused(
        `a child of ${parent.id} would sit at depth ${parent.depth + 1}, over the limit of ${this.limits.maxDepth}`,
      );
    }
  }

  /**
   * Run `job` for every item, at most maxParallel at a time, and resolve with
   * the results in the order of the items. `job` must not reject: a child that
   * fails is a result, not an exception.
   */
  async runBounded<T, R>(items: readonly T[], job: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const lane = async (): Promise<void> => {
      while (next < items.length) {
        const index = next++;
        results[index] = await job(items[index]!);
      }
    };
    const lanes = Math.min(this.limits.maxParallel, items.length);
    await Promise.all(Array.from({ length: lanes }, lane));
    return results;
  }
}
