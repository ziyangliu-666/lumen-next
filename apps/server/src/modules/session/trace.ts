import type {
  Money,
  Session,
  SessionMode,
  SessionSnapshot,
  SessionSummary,
  Step,
  StepDetail,
  StepKind,
  TaskStatus,
} from '@lumen/contracts';
import type { PendingApproval, TaskRecord } from '../../core/domain/task.js';

// The durable record of a session: its tasks and their steps, in the order
// they happened. Every write goes through here and nowhere else, so the
// snapshot a reconnecting browser reads is the same thing the events described.
//
// Two implementations sit behind it. PgTrace is the real one. MemoryTrace is
// for a process started without DATABASE_URL and for unit tests of the kernel;
// one suite (traceContract.ts) runs against both, so they cannot drift.
/** The rows of one session. The kernel adds the rolled-up spend to make a SessionSnapshot. */
export type TraceSnapshot = Omit<SessionSnapshot, 'spend' | 'totals'>;

/** A spend to record with a step: how much, and why, as the ledger will say it. */
export interface Charged {
  readonly amount: Money;
  readonly reason: string;
}

export interface Trace {
  openSession(projectId: string, accountId: string, mode: SessionMode): Promise<Session>;
  session(id: string): Promise<Session | null>;
  /** Throws when parentId names no task: a child of nothing is a bug upstream. */
  openTask(
    sessionId: string,
    parentId: string | null,
    agent: string,
    title: string,
  ): Promise<TaskRecord>;
  task(id: string): Promise<TaskRecord | null>;
  /** The task opened with no parent. Null when the session is unknown. */
  rootOf(sessionId: string): Promise<TaskRecord | null>;
  /** Ending statuses (ended, stopped, failed) also stamp endedAt. */
  setStatus(taskId: string, status: TaskStatus): Promise<TaskRecord>;
  /** What the task waits for; null clears it. */
  setPending(taskId: string, pending: PendingApproval | null): Promise<TaskRecord>;
  /** The task whose pending operation carries this approval id. */
  taskByApproval(approvalId: string): Promise<TaskRecord | null>;
  /** `detail` is kept as given and read back as given; absent stays absent. */
  appendStep(taskId: string, kind: StepKind, text: string, detail?: StepDetail): Promise<Step>;
  /**
   * A step that shows a cost, and the charge for it, as one write: both are
   * kept or neither is. Returns the step and the task with its new own cost.
   */
  appendCostedStep(
    taskId: string,
    kind: StepKind,
    text: string,
    detail: StepDetail,
    charge: Charged,
  ): Promise<{ step: Step; task: TaskRecord }>;
  /** Add to the task's own cost and return the task with its new total. */
  addCost(taskId: string, amount: Money, reason?: string): Promise<TaskRecord>;
  snapshot(sessionId: string): Promise<TraceSnapshot | null>;
  /**
   * Every task still queued, running or waiting, in any session. After a
   * restart these are the tasks whose process is gone.
   */
  openTasks(): Promise<TaskRecord[]>;
  /**
   * The sessions of one project, newest first, without their tasks and steps.
   * A project card is drawn from this on every poll, so it must stay one cheap
   * read however long the sessions ran.
   */
  summaries(projectId: string): Promise<SessionSummary[]>;
}

const ENDING: readonly TaskStatus[] = ['ended', 'stopped', 'failed'];

export function isEnding(status: TaskStatus): boolean {
  return ENDING.includes(status);
}
