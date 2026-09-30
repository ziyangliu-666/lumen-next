import type { Money, Task, TaskStatus } from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';
import type { CheckPoint } from './budget.js';
import type { Delegated } from './worker.js';

/**
 * What a waiting task is waiting for: the operation the guard escalated, kept
 * whole so that a restart does not lose it and an approval can run exactly it.
 */
export interface PendingApproval {
  readonly attemptId: string;
  readonly approvalId: string;
  readonly at: CheckPoint;
  /** The input of the blocked turn, or the title of the blocked task. */
  readonly input: string;
  /** The fan-out that was refused, when `at` is 'fan-out'. */
  readonly work?: readonly Delegated[];
}

// Server-side task record. The Composite that rolls cost up the tree lives in
// the session slice; this is just the datum it composes.
export interface TaskRecord extends Task {
  readonly childIds: readonly string[];
  /** Present while the task waits for an approval. */
  readonly pending?: PendingApproval;
}

export function makeTask(
  id: string,
  sessionId: string,
  parentId: string | null,
  agent: string,
  title: string,
  depth: number,
): TaskRecord {
  return {
    id,
    sessionId,
    parentId,
    agent,
    title,
    depth,
    status: 'queued' as TaskStatus,
    ownCost: zero,
    startedAt: Date.now(),
    endedAt: null,
    childIds: [],
  };
}

/** A task's total is its own spend plus whatever its children rolled up. */
export function rollableCost(task: TaskRecord, childRollup: Money): Money {
  return add(task.ownCost, childRollup);
}
