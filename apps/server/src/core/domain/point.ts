import type { EdgeKind, Money, Point, PointStatus } from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';

// Server-side point record. The Composite that rolls cost up along delegate
// edges lives in the session slice; this is just the datum it composes.
export interface PointRecord extends Point {
  readonly childIds: readonly string[];
}

export function makePoint(
  id: string,
  lineId: string,
  parentId: string | null,
  edge: EdgeKind | null,
): PointRecord {
  return {
    id,
    lineId,
    parentId,
    edgeFromParent: edge,
    status: 'queued' as PointStatus,
    ownCost: zero,
    childIds: [],
  };
}

/** Cost rolls up along delegate edges only. Branch and compact do not. */
export function rollableCost(point: PointRecord, childRollup: Money): Money {
  return add(point.ownCost, childRollup);
}
