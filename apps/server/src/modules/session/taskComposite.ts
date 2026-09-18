import type { Money, Task } from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';

// Composite. A leaf task and a task with children answer cost(), cancel() and
// size() the same way, so the caller holds one Node and never asks which it is.
// The tree walk is written once, here, instead of once per operation.
export interface Node {
  cost(): Money;
  cancel(): void;
  size(): number;
}

export class TaskNode implements Node {
  private cancelled = false;
  private readonly children: TaskNode[] = [];

  constructor(
    readonly id: string,
    private readonly ownCost: Money,
  ) {}

  addChild(node: TaskNode): void {
    this.children.push(node);
  }

  cost(): Money {
    return this.children.reduce((sum, c) => add(sum, c.cost()), this.ownCost);
  }

  cancel(): void {
    this.cancelled = true;
    for (const c of this.children) c.cancel();
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  size(): number {
    return this.children.reduce((n, c) => n + c.size(), 1);
  }

  /** This node or the descendant with that id. Stop and cost start from any task. */
  find(id: string): TaskNode | null {
    if (this.id === id) return this;
    for (const c of this.children) {
      const found = c.find(id);
      if (found) return found;
    }
    return null;
  }

  /** This node and every descendant, parents before children. */
  flatten(): TaskNode[] {
    return [this, ...this.children.flatMap((c) => c.flatten())];
  }
}

export const noCost: Money = zero;

/**
 * Build the tree of one session from its task rows. The rows say parent_id;
 * this is the one place that turns them into nodes, so no caller walks
 * parent_id by hand — which is the brute force the Composite replaced.
 * Returns the root, or null when there is none.
 */
export function buildTree(tasks: readonly Task[]): TaskNode | null {
  const nodes = new Map(tasks.map((task) => [task.id, new TaskNode(task.id, task.ownCost)]));
  let root: TaskNode | null = null;
  for (const task of tasks) {
    const node = nodes.get(task.id)!;
    const parent = task.parentId === null ? null : nodes.get(task.parentId);
    if (parent) parent.addChild(node);
    else if (task.parentId === null) root = node;
  }
  return root;
}
