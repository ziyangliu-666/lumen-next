import type { Task } from './tasks.js';

// A session is one run under a project: the root task and everything it
// delegated. The browser opens a session, not a task, and the snapshot is what
// it reads back when the socket (re)connects.
export interface Session {
  readonly id: string;
  readonly projectId: string;
  readonly accountId: string;
  readonly startedAt: number;
}

// One line of a task's trace. Sprint 1 keeps a step to text; the richer step
// (kind, timing, streamed body) in docs/ARCHITECTURE.md §5 lands with the
// steering slice and adds fields, never repurposes these.
export interface Step {
  readonly taskId: string;
  /** Position inside the task, from 0. Matches `step.appended`. */
  readonly index: number;
  readonly text: string;
}

/** What `GET /api/sessions/:id` returns, and what the page starts from. */
export interface SessionSnapshot {
  readonly session: Session;
  readonly tasks: readonly Task[];
  readonly steps: readonly Step[];
}
