import type { ClientCommand } from '@lumen/contracts';

// Command pattern. A user's mid-turn message is queued as an object and
// applied at a chosen moment inside a running turn; it is undoable before it
// lands, and cannot be undone after.
//
// Considered and set aside (README asks for the comparison, not just the pick):
//
// - Strategy answers "which algorithm accomplishes this". It would fit if
//   *how* a landed steer reaches the worker varied — one sink today, maybe a
//   different one later — but the design problem here is "when", not "how",
//   and Strategy has no vocabulary for a moment in time.
// - Null Object answers "how do we avoid a null the caller must guard".
//   Nothing here needs that: a cancelled steer is removed from the queue, not
//   replaced with an inert stand-in, and there is no "do nothing" steer to
//   begin with. Null Object earns its place one layer down instead — a
//   compute provider that does nothing is a real object worth having, and
//   that is `NullCompute`, not this file.
// - Command fits because the three things the problem asks for — queue it,
//   apply it later, undo it before it lands — are exactly the three things
//   Command gives an object: hold state, apply(), undo().

/** The one moment vocabulary the contract defines, read off ClientCommand so
 * the two cannot drift: extending the contract's `when` extends this too. */
export type SteerWhen = Extract<ClientCommand, { type: 'task.steer' }>['when'];

export interface Command {
  apply(): void;
  undo(): void;
}

export class AlreadyLandedError extends Error {}

export class SteerCommand implements Command {
  private landed = false;

  constructor(
    readonly id: string,
    readonly taskId: string,
    readonly text: string,
    readonly when: SteerWhen,
    private readonly sink: (taskId: string, text: string) => void,
  ) {}

  apply(): void {
    // flush() only ever calls this once per command, but idempotence here
    // means a caller cannot cause a double delivery by calling it twice.
    if (this.landed) return;
    this.landed = true;
    this.sink(this.taskId, this.text);
  }

  undo(): void {
    // Undo only means anything before apply(). Once landed it is history — the
    // message already reached the worker, and pretending otherwise would be a
    // promise the queue cannot keep.
    if (this.landed) throw new AlreadyLandedError(`steer ${this.id} already landed`);
  }

  get hasLanded(): boolean {
    return this.landed;
  }
}

/**
 * Holds the steers waiting to land. `flush(when)` is called by the worker loop
 * at the two moments the contract names: between turns, and between the
 * worker's own steps.
 *
 * Invariant this class keeps: a command in `pending` has never landed. flush()
 * removes a command the instant it applies it, so cancel() never has to check
 * — finding it in the queue is proof it is still cancellable.
 */
export class SteerQueue {
  private readonly pending: SteerCommand[] = [];

  enqueue(command: SteerCommand): void {
    this.pending.push(command);
  }

  /** False when `id` is unknown or already landed — cancelling is a no-op then, not an error. */
  cancel(id: string): boolean {
    const index = this.pending.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const [command] = this.pending.splice(index, 1);
    command!.undo();
    return true;
  }

  flush(when: SteerWhen): void {
    const ready = this.pending.filter((c) => c.when === when);
    for (const command of ready) command.apply();
    const remaining = this.pending.filter((c) => c.when !== when);
    this.pending.splice(0, this.pending.length, ...remaining);
  }

  get size(): number {
    return this.pending.length;
  }

  /** A snapshot for a test or a "pending steers" panel — not the live array. */
  list(): readonly SteerCommand[] {
    return [...this.pending];
  }
}
