import { randomUUID } from 'node:crypto';
import type { WorkerReport } from '../../core/domain/worker.js';
import { SteerCommand, SteerQueue, type SteerWhen } from './steerCommand.js';

// The seam between task.steer (arrives on the broker, at any moment, for
// whichever task the browser names) and a running Worker.run() (which alone
// holds the WorkerReport a landed steer must write through). Neither can see
// the other directly: the command handler runs outside any particular run,
// and a run's WorkerReport is only ever a call-scoped argument.
//
// A task run registers itself once, at the top of Worker.run(); every
// task.steer for that task id finds it there until the run ends.

export class NoActiveRun extends Error {}

interface Entry {
  readonly queue: SteerQueue;
  readonly report: WorkerReport;
}

export class SteerRegistry {
  private readonly active = new Map<string, Entry>();

  /** Called once at the top of a task's run. Returns the queue that run's Worker flushes. */
  begin(taskId: string, report: WorkerReport): SteerQueue {
    const queue = new SteerQueue();
    this.active.set(taskId, { queue, report });
    return queue;
  }

  /** Called once the run has settled. Whatever never got flushed goes with it. */
  end(taskId: string): void {
    this.active.delete(taskId);
  }

  /**
   * Queues a steer for a task's current run. Throws `NoActiveRun` for a task
   * that is not running right now — queued, ended, or unknown all look the
   * same from here, and the caller (registerCommands) turns that into the one
   * answer a client gets for all three: this cannot be steered right now.
   */
  steer(taskId: string, text: string, when: SteerWhen): void {
    const entry = this.active.get(taskId);
    if (!entry) throw new NoActiveRun(`task ${taskId} is not running`);
    const command = new SteerCommand(randomUUID(), taskId, text, when, (id, landedText) => {
      // A landed steer becomes a 'you' step: the same kind a fresh turn's
      // words get, because from the trace's point of view that is what it is
      // — the user spoke, mid-turn instead of between them.
      //
      // apply() is synchronous, so this cannot be awaited, and on Node an
      // unhandled rejection ends the process. If the kernel refuses the step
      // (the task was stopped a moment earlier, or the record failed), this
      // one steer is lost — and that must be the whole of the damage, not the
      // server and every other session with it. Awaiting it, so a steer also
      // lands in order before the step after it, comes with the model loop,
      // where a flush becomes "before the next model call".
      entry.report.appendStep(id, 'you', landedText).catch(() => undefined);
    });
    entry.queue.enqueue(command);
  }
}
