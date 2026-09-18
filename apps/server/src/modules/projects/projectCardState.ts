export interface CardDescriptor {
  readonly label: string;
  readonly tone: 'muted' | 'active' | 'decide' | 'keep' | 'gap';
  readonly actions: readonly ('open-session' | 'stop')[];
  readonly refreshPolicy: 'continue' | 'stop';
}

export interface ProjectCardState {
  describe(): CardDescriptor;
}

export class QueuedState implements ProjectCardState {
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
  describe(): CardDescriptor {
    return {
      label: 'Failed',
      tone: 'gap',
      actions: ['open-session'],
      refreshPolicy: 'stop',
    };
  }
}
