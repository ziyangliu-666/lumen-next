import { randomUUID } from 'node:crypto';
import type {
  Money,
  Session,
  SessionMode,
  SessionSummary,
  Step,
  StepDetail,
  StepKind,
  TaskStatus,
} from '@lumen/contracts';
import { add, zero } from '@lumen/contracts';
import { makeTask, type PendingApproval, type TaskRecord } from '../../core/domain/task.js';
import { isEnding, type Charged, type Trace, type TraceSnapshot } from './trace.js';

// The record kept in process memory. A restart forgets it, so it is for a
// process started without DATABASE_URL and for unit tests of the kernel. The
// methods are async only because the interface is: nothing here waits.
export class MemoryTrace implements Trace {
  private readonly sessions = new Map<string, Session>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly steps = new Map<string, Step[]>();

  openSession(
    projectId: string,
    accountId: string,
    mode: SessionMode,
    model?: string,
  ): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      mode,
      projectId,
      accountId,
      startedAt: Date.now(),
      ...(model ? { model } : {}),
    };
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

  setPending(taskId: string, pending: PendingApproval | null): Promise<TaskRecord> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error(`trace: no task ${taskId}`));
    const { pending: _dropped, ...rest } = task;
    const next: TaskRecord = pending ? { ...rest, pending } : rest;
    this.tasks.set(taskId, next);
    return Promise.resolve(next);
  }

  taskByApproval(approvalId: string): Promise<TaskRecord | null> {
    for (const task of this.tasks.values()) {
      if (task.pending?.approvalId === approvalId) return Promise.resolve(task);
    }
    return Promise.resolve(null);
  }

  appendStep(taskId: string, kind: StepKind, text: string, detail?: StepDetail): Promise<Step> {
    if (!this.tasks.has(taskId)) return Promise.reject(new Error(`trace: no task ${taskId}`));
    const list = this.steps.get(taskId) ?? [];
    const step: Step = { taskId, index: list.length, kind, text, ...(detail ? { detail } : {}) };
    list.push(step);
    this.steps.set(taskId, list);
    return Promise.resolve(step);
  }

  async appendCostedStep(
    taskId: string,
    kind: StepKind,
    text: string,
    detail: StepDetail,
    charge: Charged,
  ): Promise<{ step: Step; task: TaskRecord }> {
    // Charge first: addCost is the write that can refuse, and a refusal must
    // leave no step behind. Nothing here waits, so nothing can come between.
    const task = await this.addCost(taskId, charge.amount);
    const step = await this.appendStep(taskId, kind, text, detail);
    return { step, task };
  }

  addCost(taskId: string, amount: Money): Promise<TaskRecord> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error(`trace: no task ${taskId}`));
    const next: TaskRecord = { ...task, ownCost: add(task.ownCost, amount) };
    this.tasks.set(taskId, next);
    return Promise.resolve(next);
  }

  snapshot(sessionId: string): Promise<TraceSnapshot | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.resolve(null);
    const tasks = [...this.tasks.values()].filter((task) => task.sessionId === sessionId);
    const steps = tasks.flatMap((task) => this.steps.get(task.id) ?? []);
    return Promise.resolve({ session, tasks, steps });
  }

  openTasks(): Promise<TaskRecord[]> {
    return Promise.resolve([...this.tasks.values()].filter((task) => !isEnding(task.status)));
  }

  summaries(projectId: string): Promise<SessionSummary[]> {
    const all = [...this.tasks.values()];
    const result = [...this.sessions.values()]
      .filter((session) => session.projectId === projectId)
      .map((session): SessionSummary => {
        const mine = all.filter((task) => task.sessionId === session.id);
        const root = mine.find((task) => task.parentId === null);
        return {
          id: session.id,
          mode: session.mode,
          status: root?.status ?? 'queued',
          spend: mine.reduce((sum, task) => add(sum, task.ownCost), zero),
          startedAt: session.startedAt,
          endedAt: root?.endedAt ?? null,
        };
      });
    // Newest first. Insertion order breaks a tie inside one millisecond.
    return Promise.resolve(result.reverse().sort((a, b) => b.startedAt - a.startedAt));
  }
}
