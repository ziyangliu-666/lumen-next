import type { Money, Task } from './tasks.js';

// A session is one run under a project: the root task and everything it
// delegated. The browser opens a session, not a task, and the snapshot is what
// it reads back when the socket (re)connects.
export interface Session {
  readonly id: string;
  readonly projectId: string;
  readonly accountId: string;
  readonly startedAt: number;
}

// What a step is. The order of the steps is the reasoning, and the kind says
// what happened at each point in it: the user spoke, the agent thought, a tool
// ran, work was delegated, the agent answered.
export const STEP_KINDS = ['you', 'thinking', 'tool', 'delegate', 'reply'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

// One line of a task's trace. The richer step (timing, streamed body, cost) in
// docs/ARCHITECTURE.md §4 lands with the steering slice and adds fields, never
// repurposes these.
export interface Step {
  readonly taskId: string;
  /** Position inside the task, from 0. Matches `step.appended`. */
  readonly index: number;
  readonly kind: StepKind;
  readonly text: string;
}

/** What `GET /api/sessions/:id` returns, and what the page starts from. */
export interface SessionSnapshot {
  readonly session: Session;
  readonly tasks: readonly Task[];
  readonly steps: readonly Step[];
  /**
   * Each task's cost with its descendants rolled up, by task id. A task with
   * no entry has spent nothing. Kept current by `task.total`.
   */
  readonly totals: Readonly<Record<string, Money>>;
  /**
   * What the whole session has spent: the root task's cost with every
   * descendant rolled up. For display; the browser never adds.
   */
  readonly spend: Money;
}
