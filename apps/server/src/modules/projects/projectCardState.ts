export interface CardDescriptor {
  readonly label: string;
  readonly tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  readonly actions: readonly ('open-session' | 'stop')[];
  readonly refreshPolicy: 'continue' | 'stop';
}

export interface ProjectCardState {
  describe(): CardDescriptor;
  stop(command: () => Promise<void>): Promise<'stop_requested' | 'already_terminal'>;
  pollDelay(): number | null;
}

export class QueuedState implements ProjectCardState {
  async stop(command: () => Promise<void>): Promise<'stop_requested'> {
    await command();
    return 'stop_requested';
  }
  pollDelay(): number {
    return 5000;
  }
  describe(): CardDescriptor {
    return {
      label: 'Queued',
      tone: 'muted',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    };
  }
}

export class RunningState implements ProjectCardState {
  async stop(command: () => Promise<void>): Promise<'stop_requested'> {
    await command();
    return 'stop_requested';
  }
  pollDelay(): number {
    return 5000;
  }
  describe(): CardDescriptor {
    return {
      label: 'Running',
      tone: 'active',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    };
  }
}

export class WaitingState implements ProjectCardState {
  async stop(command: () => Promise<void>): Promise<'stop_requested'> {
    await command();
    return 'stop_requested';
  }
  pollDelay(): number {
    return 15000;
  }
  describe(): CardDescriptor {
    return {
      label: 'Waiting for you',
      tone: 'decide',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    };
  }
}

export class FinishedState implements ProjectCardState {
  stop(_command: () => Promise<void>): Promise<'already_terminal'> {
    return Promise.resolve('already_terminal');
  }
  pollDelay(): null {
    return null;
  }
  describe(): CardDescriptor {
    return {
      label: 'Finished',
      tone: 'keep',
      actions: ['open-session'],
      refreshPolicy: 'stop',
    };
  }
}

export class StoppedState implements ProjectCardState {
  stop(_command: () => Promise<void>): Promise<'already_terminal'> {
    return Promise.resolve('already_terminal');
  }
  pollDelay(): null {
    return null;
  }
  describe(): CardDescriptor {
    return {
      label: 'Stopped',
      tone: 'gap',
      actions: ['open-session'],
      refreshPolicy: 'stop',
    };
  }
}

export class FailedState implements ProjectCardState {
  stop(_command: () => Promise<void>): Promise<'already_terminal'> {
    return Promise.resolve('already_terminal');
  }
  pollDelay(): null {
    return null;
  }
  describe(): CardDescriptor {
    return {
      label: 'Failed',
      tone: 'gap',
      actions: ['open-session'],
      refreshPolicy: 'stop',
    };
  }
}
