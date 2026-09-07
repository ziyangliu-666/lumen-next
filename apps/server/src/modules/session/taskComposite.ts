import type { Money } from '@lumen/contracts';
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
    private ownCost: Money,
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
}

export const noCost: Money = zero;
