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
  /**
   * The model this session thinks with, chosen when it opened. Absent: the
   * server's default. The choice is among the models the server allows
   * (GET /api/models). A later turn may change it.
   */
  readonly model?: string;
  /**
   * A short name the model wrote after the first question. Absent: the page
   * names the session by its question, as it did before titles.
   */
  readonly title?: string;
}

// What a step is. The order of the steps is the reasoning, and the kind says
// what happened at each point in it: the user spoke, the agent thought, a tool
// ran, work was delegated, the agent answered.
export const STEP_KINDS = ['you', 'thinking', 'tool', 'delegate', 'reply'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

// One row of a tool step's result: where it looked, what it asked, what came
// back. "arxiv · permutation statistics · 41 papers". `empty` marks the row
// that found nothing, which is often the row that matters.
export interface StepRow {
  readonly source: string;
  readonly text: string;
  readonly result: string;
  readonly empty?: boolean;
  /** Where the result can be read (an OEIS entry, an arXiv abstract). https only. */
  readonly url?: string;
}

// What a step carries beyond its one line of text. All of it is optional, and
// a step with none of it is a complete step: `text` alone always says what
// happened. The page draws what is here and leaves out what is not.
export interface StepDetail {
  /** The tool a tool step ran: 'search', 'run', 'save', 'record'. The block's label. */
  readonly tool?: string;
  /** How long it took. */
  readonly durationMs?: number;
  /** What this one step cost. The task's own cost is the sum the kernel keeps; this is the receipt. */
  readonly cost?: Money;
  /** A tool's result as rows, when it has that shape. */
  readonly rows?: readonly StepRow[];
  /** A tool's result as text: a terminal's output, a file's diff. Shown in a fixed-width block. */
  readonly output?: string;
  /** The tasks a delegate step opened, in the order it opened them. */
  readonly childTaskIds?: readonly string[];
  /**
   * On a 'you' step that edits the person's latest message: the index of
   * the 'you' step it replaces, or -1 for the question that opened the
   * session. That message and everything after it are no longer the
   * conversation; the page hides them and the model is not given them.
   */
  readonly replaces?: number;
}

// One line of a task's trace, and what it carried.
export interface Step {
  readonly taskId: string;
  /** Position inside the task, from 0. Matches `step.appended`. */
  readonly index: number;
  readonly kind: StepKind;
  readonly text: string;
  readonly detail?: StepDetail;
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
  /**
   * A short name for the finding, written by the agent that kept it, for
   * the lists. Absent on findings kept before names.
   */
  readonly title?: string;
  readonly createdAt: number;
}
