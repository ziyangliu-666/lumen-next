// The domain rule: a point is the lifetime of one agent context window.
// Four things open a window, and nothing else does.
export type EdgeKind = 'delegate' | 'branch' | 'compact' | 'handover';

export type PointStatus = 'idle' | 'running' | 'ended' | 'compacted';

export interface Money {
  /** Whole US cents. Integer maths only; never a float dollar amount. */
  readonly cents: number;
}

export interface Point {
  readonly id: string;
  readonly lineId: string;
  readonly parentId: string | null;
  readonly edgeFromParent: EdgeKind | null;
  readonly status: PointStatus;
  /** This point's own spend, excluding children. */
  readonly ownCost: Money;
}

export const zero: Money = { cents: 0 };

export function add(a: Money, b: Money): Money {
  return { cents: a.cents + b.cents };
}
