import type { TaskStatus } from '@lumen/contracts';
import type { CardDescriptor, ProjectCardState } from './projectCardState.js';
import {
  FailedState,
  FinishedState,
  QueuedState,
  RunningState,
  StoppedState,
  WaitingState,
} from './projectCardState.js';

/** Internal projection, not an extension of the shared Session contract. */
export interface ConfirmedSessionSummary {
  readonly status: TaskStatus;
}

// Stateless implementations can be shared; each context owns its selection.
const states = {
  queued: new QueuedState(),
  running: new RunningState(),
  waiting: new WaitingState(),
  ended: new FinishedState(),
  stopped: new StoppedState(),
  failed: new FailedState(),
} satisfies Record<TaskStatus, ProjectCardState>;

/** Projects confirmed state and delegates actions without owning session transitions. */
export class ProjectCardContext {
  private state: ProjectCardState;

  constructor(summary: ConfirmedSessionSummary) {
    this.state = states[summary.status];
  }

  applySummary(summary: ConfirmedSessionSummary): void {
    this.state = states[summary.status];
  }

  describe(): CardDescriptor {
    return this.state.describe();
  }
  stop(command: () => Promise<void>): Promise<'stop_requested' | 'already_terminal'> {
    return this.state.stop(command);
  }
  pollDelay(): number | null {
    return this.state.pollDelay();
  }
}
