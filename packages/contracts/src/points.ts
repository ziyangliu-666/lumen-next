// The domain rule: a point is the lifetime of one agent context window.
// Four things open a window, and nothing else does.
export type EdgeKind = 'delegate' | 'branch' | 'compact' | 'handover';

// Where a point is in its life. A compacted window is an 'ended' point with a
// 'compact' edge to its successor, so compaction is an edge, not a status.
export type PointStatus =
  | 'queued' // delegated, no worker yet
  | 'running'
  | 'waiting' // needs the user: a question, or an approval over the cap
  | 'ended' // finished on its own
  | 'stopped' // the user stopped it, or the process died under it
  | 'failed';

export interface Money {
  /**
   * US dollars, as a JS number, for transport and display only. The database
   * column is numeric(12,6) and every sum happens in SQL, because a float
   * total drifts. The browser formats to four decimals and never adds: two
   * decimals once showed a $0.006 cap as "$0.01", a number nobody had set.
   */
  readonly dollars: number;
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

export const zero: Money = { dollars: 0 };

export function add(a: Money, b: Money): Money {
  // In-memory only, for a tree already loaded. Durable totals are summed in SQL.
  return { dollars: a.dollars + b.dollars };
}
