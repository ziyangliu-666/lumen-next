// The session side of a turn (docs/platform/contract.md, "A turn"). The kernel
// takes a Worker and does not know where it runs. QueueWorker is that Worker:
// it puts the turn on lumen.turns and waits until a worker pod says the turn is
// done. While it waits, it keeps the kernel's real WorkerReport, so the
// worker's report calls (turnRoutes.ts) land on it as if the worker ran here.
import { randomUUID } from 'node:crypto';
import type { Task } from '@lumen/contracts';
import { WaitingForApproval, type Worker, type WorkerReport } from '../../core/domain/worker.js';
import type { TurnMessage } from './rabbit.js';

/** How a worker pod ends a turn. `waiting` keeps the kernel's approval path. */
export interface TurnOutcome {
  readonly ok: boolean;
  readonly error?: string;
  readonly waiting?: boolean;
}

interface PendingTurn {
  readonly report: WorkerReport;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

export class QueueWorker implements Worker {
  private readonly pending = new Map<string, PendingTurn>();

  constructor(
    private readonly publish: (turn: TurnMessage) => Promise<void>,
    private readonly newId: () => string = randomUUID,
  ) {}

  run(task: Task, input: string, report: WorkerReport): Promise<void> {
    const turnId = this.newId();
    return new Promise<void>((resolve, reject) => {
      this.pending.set(turnId, { report, resolve, reject });
      this.publish({ turnId, task, input }).catch((error: unknown) => {
        this.pending.delete(turnId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  /** The report of a turn still in flight, or null when session no longer knows it. */
  report(turnId: string): WorkerReport | null {
    return this.pending.get(turnId)?.report ?? null;
  }

  /** End a turn. False when the turn is unknown, for example after a session restart. */
  settle(turnId: string, outcome: TurnOutcome): boolean {
    const turn = this.pending.get(turnId);
    if (!turn) return false;
    this.pending.delete(turnId);
    if (outcome.ok) turn.resolve();
    else if (outcome.waiting) turn.reject(new WaitingForApproval(outcome.error ?? 'waiting'));
    else turn.reject(new Error(outcome.error ?? 'the worker failed the turn'));
    return true;
  }

  /** Turns published and not yet done. Shown on /internal/health for the demo. */
  get inFlight(): number {
    return this.pending.size;
  }
}
