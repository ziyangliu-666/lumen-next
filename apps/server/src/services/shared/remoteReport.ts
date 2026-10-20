// The worker side of the report (docs/platform/contract.md, "The report"). The
// worker loop is unchanged: it gets a WorkerReport, and this one sends each
// call to session over HTTP. turnRoutes.ts is the other end.
import type { Finding, Money, StepDetail, StepKind, Task } from '@lumen/contracts';
import { WaitingForApproval, type Delegated, type WorkerReport } from '../../core/domain/worker.js';
import type { Log } from '../../core/log/log.js';
import { InternalCallError, type InternalCall } from './internal.js';
import { WAITING_STATUS } from './turnRoutes.js';

/** Delegate waits until every child is at rest, and children are whole turns. */
export const DELEGATE_TIMEOUT_MS = 15 * 60_000;

export class RemoteReport implements WorkerReport {
  constructor(
    private readonly call: InternalCall,
    private readonly turnId: string,
    readonly log: Log,
  ) {}

  private async send<T>(member: string, body: object, timeoutMs?: number): Promise<T> {
    try {
      return await this.call<T>(
        `/internal/turns/${encodeURIComponent(this.turnId)}/${member}`,
        body,
        timeoutMs === undefined ? undefined : { timeoutMs },
      );
    } catch (error) {
      // The kernel ends the turn quietly on WaitingForApproval and runs the
      // work once it is approved. It must arrive here as that class.
      if (error instanceof InternalCallError && error.status === WAITING_STATUS) {
        throw new WaitingForApproval(error.message);
      }
      throw error;
    }
  }

  appendStep(taskId: string, kind: StepKind, text: string, detail?: StepDetail): Promise<void> {
    return this.send('step', { taskId, kind, text, ...(detail ? { detail } : {}) });
  }

  async delegate(taskId: string, work: readonly Delegated[]): Promise<Task[]> {
    const { children } = await this.send<{ children: Task[] }>(
      'delegate',
      { taskId, work },
      DELEGATE_TIMEOUT_MS,
    );
    return children;
  }

  recordFinding(taskId: string, text: string, title?: string): Promise<Finding> {
    return this.send('finding', { taskId, text, ...(title === undefined ? {} : { title }) });
  }

  addSpend(taskId: string, amount: Money, reason: string): Promise<void> {
    return this.send('spend', { taskId, amount, reason });
  }

  async stopped(taskId: string): Promise<boolean> {
    const { stopped } = await this.send<{ stopped: boolean }>('stopped', { taskId });
    return stopped;
  }

  /** A draft is a live preview: losing one is harmless, so it is not awaited. */
  draft(taskId: string, text: string): void {
    this.send('draft', { taskId, text }).catch((error: unknown) =>
      this.log.debug({ err: error }, 'draft not delivered'),
    );
  }

  retitle(taskId: string, title: string): Promise<void> {
    return this.send('retitle', { taskId, title });
  }
}
