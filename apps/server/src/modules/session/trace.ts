import { randomUUID } from 'node:crypto';
import type { Session, SessionSnapshot, Step, TaskStatus } from '@lumen/contracts';
import { makeTask, type TaskRecord } from '../../core/domain/task.js';

// The durable record of a session: its tasks and their steps, in the order
// they happened. Every write goes through here and nowhere else, so the
// snapshot a reconnecting browser reads is the same thing the events described.
//
// Sprint 1 keeps it in memory. The Postgres version behind the same methods
// arrives with core/db; the kernel does not change when it does.
export class Trace {
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly steps = new Map<string, Step[]>();

  openSession(projectId: string, accountId: string): Session {
    const session: Session = { id: randomUUID(), projectId, accountId, startedAt: Date.now() };
    this.sessions.set(session.id, session);
    return session;
  }

  session(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  openTask(sessionId: string, parentId: string | null, agent: string, title: string): TaskRecord {
    const parent = parentId === null ? null : this.tasks.get(parentId);
    if (parentId !== null && !parent) throw new Error(`trace: no parent task ${parentId}`);
    const depth = parent ? parent.depth + 1 : 0;
    const task = makeTask(randomUUID(), sessionId, parentId, agent, title, depth);
    this.tasks.set(task.id, task);
    if (parent) this.tasks.set(parent.id, { ...parent, childIds: [...parent.childIds, task.id] });
    return task;
  }

  task(id: string): TaskRecord | null {
    return this.tasks.get(id) ?? null;
  }

  /** The root task is the one opened first with no parent. */
  rootOf(sessionId: string): TaskRecord | null {
    for (const task of this.tasks.values()) {
      if (task.sessionId === sessionId && task.parentId === null) return task;
    }
    return null;
  }

  setStatus(taskId: string, status: TaskStatus): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`trace: no task ${taskId}`);
    const ended = status === 'ended' || status === 'stopped' || status === 'failed';
    const next: TaskRecord = { ...task, status, endedAt: ended ? Date.now() : null };
    this.tasks.set(taskId, next);
    return next;
  }

  appendStep(taskId: string, text: string): Step {
    if (!this.tasks.has(taskId)) throw new Error(`trace: no task ${taskId}`);
    const list = this.steps.get(taskId) ?? [];
    const step: Step = { taskId, index: list.length, text };
    list.push(step);
    this.steps.set(taskId, list);
    return step;
  }

  snapshot(sessionId: string): SessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const tasks = [...this.tasks.values()].filter((task) => task.sessionId === sessionId);
    const steps = tasks.flatMap((task) => this.steps.get(task.id) ?? []);
    return { session, tasks, steps };
  }
}
