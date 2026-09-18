import type { Session, SessionSnapshot, Step, TaskStatus } from '@lumen/contracts';
import type { TaskRecord } from '../../core/domain/task.js';

// The durable record of a session: its tasks and their steps, in the order
// they happened. Every write goes through here and nowhere else, so the
// snapshot a reconnecting browser reads is the same thing the events described.
//
// Two implementations sit behind it. PgTrace is the real one. MemoryTrace is
// for a process started without DATABASE_URL and for unit tests of the kernel;
// one suite (traceContract.ts) runs against both, so they cannot drift.
export interface Trace {
  openSession(projectId: string, accountId: string): Promise<Session>;
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
  appendStep(taskId: string, text: string): Promise<Step>;
  snapshot(sessionId: string): Promise<SessionSnapshot | null>;
  /**
   * Every task still queued, running or waiting, in any session. After a
   * restart these are the tasks whose process is gone.
   */
  openTasks(): Promise<TaskRecord[]>;
}

const ENDING: readonly TaskStatus[] = ['ended', 'stopped', 'failed'];

export function isEnding(status: TaskStatus): boolean {
  return ENDING.includes(status);
}
