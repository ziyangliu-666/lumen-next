// State pattern. Each state is an object that knows its own label and its own
// legal transitions. No 'switch (status)' anywhere else in the slice.
export type StateName = 'running' | 'waiting' | 'finished' | 'stopped';

export interface ProjectState {
  readonly name: StateName;
  readonly label: string;
  /** Whether the poller should keep refreshing this card. */
  readonly live: boolean;
  onEvent(event: ProjectEvent): ProjectState;
}

export type ProjectEvent = 'needs-user' | 'resumed' | 'done' | 'stop';

class Running implements ProjectState {
  readonly name = 'running' as const;
  readonly label = 'Running';
  readonly live = true;
  onEvent(e: ProjectEvent): ProjectState {
    if (e === 'needs-user') return states.waiting;
    if (e === 'done') return states.finished;
    if (e === 'stop') return states.stopped;
    return this;
  }
}
class Waiting implements ProjectState {
  readonly name = 'waiting' as const;
  readonly label = 'Waiting on you';
  readonly live = false;
  onEvent(e: ProjectEvent): ProjectState {
    if (e === 'resumed') return states.running;
    if (e === 'stop') return states.stopped;
    return this;
  }
}
class Finished implements ProjectState {
  readonly name = 'finished' as const;
  readonly label = 'Finished';
  readonly live = false;
  onEvent(_e: ProjectEvent): ProjectState {
    return this; // terminal
  }
}
class Stopped implements ProjectState {
  readonly name = 'stopped' as const;
  readonly label = 'Stopped';
  readonly live = false;
  onEvent(_e: ProjectEvent): ProjectState {
    return this; // terminal
  }
}

export const states = {
  running: new Running(),
  waiting: new Waiting(),
  finished: new Finished(),
  stopped: new Stopped(),
} as const;
