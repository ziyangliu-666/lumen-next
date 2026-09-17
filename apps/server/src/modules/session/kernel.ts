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
// Sprint 1: one root task, one worker run per turn, no delegation yet. The
// Delegation fan-out and the BudgetGuard check points from ARCHITECTURE.md §9
// slot in here without changing the worker or the routes.
export class Kernel implements WorkerReport {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly trace: Trace,
    private readonly broker: Broker,
    private readonly worker: Worker,
  ) {}

  /** Open a session under a project and start its root task. Returns at once. */
  start(projectId: string, accountId: string, text: string): SessionSnapshot {
    const session = this.trace.openSession(projectId, accountId);
    const root = this.trace.openTask(session.id, null, 'lead', text);
    this.broker.publish(session.id, { type: 'task.opened', task: root });
    this.track(this.run(root));
    // The snapshot the caller gets already holds the root task, so the page has
    // something to draw before the first socket frame arrives.
    return this.snapshotOf(session.id);
  }

  /** A new turn on the root: the user's words become a step, then the worker runs again. */
  async say(sessionId: string, principal: Principal, text: string): Promise<void> {
    const root = this.rootFor(sessionId, principal);
    await this.appendStep(root.id, `you: ${text}`);
    this.track(this.run(root));
  }

  stop(sessionId: string, principal: Principal): void {
    const root = this.rootFor(sessionId, principal);
    if (root.endedAt !== null) return;
    this.setStatus(root.id, 'stopped');
  }

  snapshot(sessionId: string, principal: Principal): SessionSnapshot {
    this.rootFor(sessionId, principal);
    return this.snapshotOf(sessionId);
  }

  /**
   * The answer to "who may watch this session?" that core requires before it
   * opens a socket: the account that started it, or staff. An unknown session
   * and somebody else's session answer the same, so the socket route stays a
   * 404 either way and the id is not an oracle.
   */
  readonly access: SessionAccess = {
    canWatch: (principal, sessionId) => Promise.resolve(this.mayRead(principal, sessionId)),
  };

  // WorkerReport: the one door out of the worker.
  appendStep(taskId: string, text: string): Promise<void> {
    const task = this.trace.task(taskId);
    if (!task) return Promise.reject(new Error(`kernel: no task ${taskId}`));
    const step = this.trace.appendStep(taskId, text);
    this.broker.publish(task.sessionId, { type: 'step.appended', ...step });
    return Promise.resolve();
  }

  /** Resolves once every worker run started so far has settled. For tests and shutdown. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  private async run(task: Task): Promise<void> {
    this.setStatus(task.id, 'running');
    try {
      await this.worker.run(task, this);
      // The user may have stopped it while the worker ran; that verdict stands.
      if (this.trace.task(task.id)?.status === 'running') this.setStatus(task.id, 'ended');
    } catch {
      this.setStatus(task.id, 'failed');
    }
  }

  private track(run: Promise<void>): void {
    this.inFlight.add(run);
    void run.finally(() => this.inFlight.delete(run));
  }

  private setStatus(taskId: string, status: TaskStatus): void {
    const task = this.trace.setStatus(taskId, status);
    this.broker.publish(task.sessionId, { type: 'task.status', taskId, status });
  }

  private mayRead(principal: Principal, sessionId: string): boolean {
    const session = this.trace.session(sessionId);
    if (!session) return false;
    return session.accountId === principal.accountId || principal.role === 'staff';
  }

  private rootFor(sessionId: string, principal: Principal): Task {
    if (!this.mayRead(principal, sessionId)) throw notFound('no such session');
    const root = this.trace.rootOf(sessionId);
    if (!root) throw notFound('no such session');
    return root;
  }

  private snapshotOf(sessionId: string): SessionSnapshot {
    const snapshot = this.trace.snapshot(sessionId);
    if (!snapshot) throw notFound('no such session');
    return snapshot;
  }
}
