import { randomUUID } from 'node:crypto';
import type { Session, SessionSnapshot, Step, TaskStatus } from '@lumen/contracts';
import { makeTask, type TaskRecord } from '../../core/domain/task.js';
import { isEnding, type Trace } from './trace.js';

// The record kept in process memory. A restart forgets it, so it is for a
// process started without DATABASE_URL and for unit tests of the kernel. The
// methods are async only because the interface is: nothing here waits.
export class MemoryTrace implements Trace {
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly steps = new Map<string, Step[]>();

  openSession(projectId: string, accountId: string): Promise<Session> {
    const session: Session = { id: randomUUID(), projectId, accountId, startedAt: Date.now() };
    this.sessions.set(session.id, session);
    return Promise.resolve(session);
  }

  session(id: string): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  openTask(
    sessionId: string,
    parentId: string | null,
    agent: string,
    title: string,
  ): Promise<TaskRecord> {
    const parent = parentId === null ? null : this.tasks.get(parentId);
    if (parentId !== null && !parent) {
      return Promise.reject(new Error(`trace: no parent task ${parentId}`));
    }
    const depth = parent ? parent.depth + 1 : 0;
    const task = makeTask(randomUUID(), sessionId, parentId, agent, title, depth);
    this.tasks.set(task.id, task);
    if (parent) this.tasks.set(parent.id, { ...parent, childIds: [...parent.childIds, task.id] });
    return Promise.resolve(task);
  }

  task(id: string): Promise<TaskRecord | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }

  /** The root task is the one opened first with no parent. */
  rootOf(sessionId: string): Promise<TaskRecord | null> {
    for (const task of this.tasks.values()) {
      if (task.sessionId === sessionId && task.parentId === null) return Promise.resolve(task);
    }
    return Promise.resolve(null);
  }

  setStatus(taskId: string, status: TaskStatus): Promise<TaskRecord> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error(`trace: no task ${taskId}`));
    const next: TaskRecord = { ...task, status, endedAt: isEnding(status) ? Date.now() : null };
    this.tasks.set(taskId, next);
    return Promise.resolve(next);
  }

  appendStep(taskId: string, text: string): Promise<Step> {
    if (!this.tasks.has(taskId)) return Promise.reject(new Error(`trace: no task ${taskId}`));
    const list = this.steps.get(taskId) ?? [];
    const step: Step = { taskId, index: list.length, text };
    list.push(step);
    this.steps.set(taskId, list);
    return Promise.resolve(step);
  }

  snapshot(sessionId: string): Promise<SessionSnapshot | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.resolve(null);
    const tasks = [...this.tasks.values()].filter((task) => task.sessionId === sessionId);
    const steps = tasks.flatMap((task) => this.steps.get(task.id) ?? []);
    return Promise.resolve({ session, tasks, steps });
  }

  openTasks(): Promise<TaskRecord[]> {
    return Promise.resolve([...this.tasks.values()].filter((task) => !isEnding(task.status)));
  }
}
