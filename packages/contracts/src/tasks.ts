// The domain rule: a task is the lifetime of one agent context window. The
// session's own run is the root task; a delegation opens a child task under it.
// Nothing else opens one.

// Where a task is in its life.
export type TaskStatus =
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

export interface Task {
  readonly id: string;
  readonly sessionId: string;
  readonly parentId: string | null;
  /** Which agent runs it: 'lead', 'reader', 'compute-perm' … */
  readonly agent: string;
  /** One line, shown as the task's title. */
  readonly title: string;
  /** 0 for the root. */
  readonly depth: number;
  readonly status: TaskStatus;
  /** This task's own spend, excluding children. */
  readonly ownCost: Money;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

export const zero: Money = { dollars: 0 };

export function add(a: Money, b: Money): Money {
  // In-memory only, for a tree already loaded. Durable totals are summed in SQL.
  return { dollars: a.dollars + b.dollars };
}
