// Command pattern. A user's mid-turn message is an object, queued and applied at
// a chosen moment, and undoable before it lands.
export type When = 'end-of-turn' | 'next-step';

export interface Command {
  apply(): void;
  undo(): void;
}

export class SteerCommand implements Command {
  private landed = false;
  constructor(
    readonly text: string,
    readonly when: When,
    private readonly sink: (text: string) => void,
  ) {}

  apply(): void {
    if (this.landed) return;
    this.landed = true;
    this.sink(this.text);
  }

  undo(): void {
    // Undo only means anything before apply(); once landed it is history.
    if (this.landed) throw new Error('cannot undo a command that already landed');
  }

  get hasLanded(): boolean {
    return this.landed;
  }
}

export class SteerQueue {
  private readonly pending: SteerCommand[] = [];

  enqueue(cmd: SteerCommand): void {
    this.pending.push(cmd);
  }

  cancelLast(): void {
    const cmd = this.pending.pop();
    cmd?.undo();
  }

  flush(when: When): void {
    const ready = this.pending.filter((c) => c.when === when);
    for (const c of ready) c.apply();
    this.pending.splice(0, this.pending.length, ...this.pending.filter((c) => c.when !== when));
  }
}
