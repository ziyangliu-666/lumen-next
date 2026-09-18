import type { Money, Task, TaskStatus } from './tasks.js';

// A session is one run under a project: the root task and everything it
// delegated. The browser opens a session, not a task, and the snapshot is what
// it reads back when the socket (re)connects.
// How a session goes about its question. 'explore' starts from the question
// alone; 'seed' starts from material the user supplied. The project chooses it
// and its first session runs in the same mode.
export const SESSION_MODES = ['explore', 'seed'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export interface Session {
  readonly id: string;
  readonly mode: SessionMode;
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

/**
 * One session as a project card needs it: no tasks, no steps. `status` and
 * `endedAt` mirror the root task; `spend` is every task of the session, summed
 * where the record lives.
 */
export interface SessionSummary {
  readonly id: string;
  readonly mode: SessionMode;
  readonly status: TaskStatus;
  readonly spend: Money;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

/** A result an agent chose to keep. The projects slice owns the record. */
export interface Finding {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly text: string;
  readonly createdAt: number;
}
