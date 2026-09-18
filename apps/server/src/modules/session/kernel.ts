import type { SessionSnapshot, Task, TaskStatus } from '@lumen/contracts';
import type { Worker, WorkerReport } from '../../core/domain/worker.js';
import type { Principal, SessionAccess } from '../../core/http/authGuard.js';
import { notFound } from '../../core/http/httpError.js';
import type { Broker } from '../../core/protocol/broker.js';
import type { Trace } from './trace.js';

// The engine of a session. It opens the root task, hands it to the worker, and
// is the WorkerReport the worker writes through: every report lands in the
// trace and on the socket in one call, so the durable record and the live
// stream cannot disagree.
//
// One root task and one worker run per turn. The Delegation fan-out and the BudgetGuard check points from ARCHITECTURE.md §9
// slot in here without changing the worker or the routes.
export class Kernel implements WorkerReport {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly trace: Trace,
    private readonly broker: Broker,
    private readonly worker: Worker,
  ) {}

  /** Open a session under a project and start its root task. Does not wait for the worker. */
  async start(projectId: string, accountId: string, text: string): Promise<SessionSnapshot> {
    const session = await this.trace.openSession(projectId, accountId);
    const root = await this.trace.openTask(session.id, null, 'lead', text);
    this.broker.publish(session.id, { type: 'task.opened', task: root });
    // Read the snapshot before the worker starts, so the caller always gets
    // the root as it was opened and the page draws the rest from the events.
    const snapshot = await this.snapshotOf(session.id);
    this.track(this.run(root));
    return snapshot;
  }

  /** A new turn on the root: the user's words become a step, then the worker runs again. */
  async say(sessionId: string, principal: Principal, text: string): Promise<void> {
    const root = await this.rootFor(sessionId, principal);
    await this.appendStep(root.id, `you: ${text}`);
    this.track(this.run(root));
  }

  async stop(sessionId: string, principal: Principal): Promise<void> {
    const root = await this.rootFor(sessionId, principal);
    if (root.endedAt !== null) return;
    await this.setStatus(root.id, 'stopped');
  }

  async snapshot(sessionId: string, principal: Principal): Promise<SessionSnapshot> {
    await this.rootFor(sessionId, principal);
    return this.snapshotOf(sessionId);
  }

  /**
   * Run once at startup, before the server listens. A task that is still
   * queued, running or waiting belongs to a process that is gone, so it cannot
   * be any of those. Nobody pressed stop, but the task was ended from outside:
   * stopped, not failed. Nothing is published, because nobody is connected yet;
   * the next snapshot a browser reads shows it.
   */
  async restore(): Promise<number> {
    const orphans = await this.trace.openTasks();
    for (const task of orphans) await this.trace.setStatus(task.id, 'stopped');
    return orphans.length;
  }

  /**
   * The answer to "who may watch this session?" that core requires before it
   * opens a socket: the account that started it, or staff. An unknown session
   * and somebody else's session answer the same, so the socket route stays a
   * 404 either way and the id is not an oracle.
   */
  readonly access: SessionAccess = {
    canWatch: (principal, sessionId) => this.mayRead(principal, sessionId),
  };

  // WorkerReport: the one door out of the worker.
  async appendStep(taskId: string, text: string): Promise<void> {
    const task = await this.trace.task(taskId);
    if (!task) throw new Error(`kernel: no task ${taskId}`);
    const step = await this.trace.appendStep(taskId, text);
    this.broker.publish(task.sessionId, { type: 'step.appended', ...step });
  }

  /** Resolves once every worker run started so far has settled. For tests and shutdown. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  private async run(task: Task): Promise<void> {
    try {
      await this.setStatus(task.id, 'running');
      await this.worker.run(task, this);
      // The user may have stopped it while the worker ran; that verdict stands.
      const now = await this.trace.task(task.id);
      if (now?.status === 'running') await this.setStatus(task.id, 'ended');
    } catch {
      // The record itself may be what failed. A run is never awaited by a
      // caller, so an error that escaped here would be an unhandled rejection.
      await this.setStatus(task.id, 'failed').catch(() => undefined);
    }
  }

  private track(run: Promise<void>): void {
    this.inFlight.add(run);
    void run.finally(() => this.inFlight.delete(run));
  }

  private async setStatus(taskId: string, status: TaskStatus): Promise<void> {
    const task = await this.trace.setStatus(taskId, status);
    this.broker.publish(task.sessionId, { type: 'task.status', taskId, status });
  }

  private async mayRead(principal: Principal, sessionId: string): Promise<boolean> {
    const session = await this.trace.session(sessionId);
    if (!session) return false;
    return session.accountId === principal.accountId || principal.role === 'staff';
  }

  private async rootFor(sessionId: string, principal: Principal): Promise<Task> {
    if (!(await this.mayRead(principal, sessionId))) throw notFound('no such session');
    const root = await this.trace.rootOf(sessionId);
    if (!root) throw notFound('no such session');
    return root;
  }

  private async snapshotOf(sessionId: string): Promise<SessionSnapshot> {
    const snapshot = await this.trace.snapshot(sessionId);
    if (!snapshot) throw notFound('no such session');
    return snapshot;
  }
}
