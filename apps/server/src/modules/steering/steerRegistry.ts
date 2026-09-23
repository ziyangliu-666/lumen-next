import { randomUUID } from 'node:crypto';
import { SteerCommand, SteerQueue, type SteerWhen } from './steerCommand.js';

// The seam between task.steer (arrives on the broker, at any moment, for
// whichever task the browser names) and a running Worker.run() (which alone
// holds the conversation a landed steer must reach). Neither can see the other
// directly: the command handler runs outside any particular run, and a run's
// conversation lives only inside that run.
//
// A task run registers itself once, at the top of Worker.run(), with the sink
// a landed steer goes to; every task.steer for that task id finds it there
// until the run ends.

export class NoActiveRun extends Error {}

/**
 * Where a landed steer goes: the running worker's own inbox. Synchronous on
 * purpose — it only hands the words over. Writing them to the trace and into
 * the model's conversation is the worker's, in order, awaited, at the moment
 * it chooses.
 */
export type SteerSink = (text: string) => void;

interface Entry {
  readonly queue: SteerQueue;
  readonly sink: SteerSink;
}

export class SteerRegistry {
  private readonly active = new Map<string, Entry>();

  /** Called once at the top of a task's run. Returns the queue that run's Worker flushes. */
  begin(taskId: string, sink: SteerSink): SteerQueue {
    const queue = new SteerQueue();
    this.active.set(taskId, { queue, sink });
    return queue;
  }

  /**
   * Called once the run is over. From here task.steer refuses this task; what
   * the queue still holds stays with the worker, which drains it itself.
   */
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
    const command = new SteerCommand(randomUUID(), taskId, text, when, (_id, landedText) =>
      entry.sink(landedText),
    );
    entry.queue.enqueue(command);
  }
}
