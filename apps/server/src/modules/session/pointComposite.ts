import type { EdgeKind, Money } from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';

// Composite. A leaf point and a point-with-children answer cost(), cancel() and
// size() the same way. The one twist the domain forces: cost rolls up along
// 'delegate' edges only. A branch or a compacted successor is its own point with
// its own number, so it does not add to the parent.
export interface Node {
  cost(): Money;
  cancel(): void;
  size(): number;
}

export class PointNode implements Node {
  private cancelled = false;
  private readonly children: Array<{ edge: EdgeKind; node: PointNode }> = [];

  constructor(
    readonly id: string,
    private ownCost: Money,
  ) {}

  addChild(edge: EdgeKind, node: PointNode): void {
    this.children.push({ edge, node });
  }

  cost(): Money {
    return this.children
      .filter((c) => c.edge === 'delegate')
      .reduce((sum, c) => add(sum, c.node.cost()), this.ownCost);
  }

  cancel(): void {
    this.cancelled = true;
    for (const c of this.children) c.node.cancel();
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  size(): number {
    return this.children.reduce((n, c) => n + c.node.size(), 1);
  }
}

export const noCost: Money = zero;
