import type { Money, Task, TaskStatus } from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';

// Server-side task record. The Composite that rolls cost up the tree lives in
// the session slice; this is just the datum it composes.
export interface TaskRecord extends Task {
  readonly childIds: readonly string[];
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
