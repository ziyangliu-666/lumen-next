import { describe, expect, it } from 'vitest';
import {
  FailedState,
  FinishedState,
  QueuedState,
  RunningState,
  StoppedState,
  WaitingState,
} from './projectCardState.js';

describe('project card states', () => {
  it.each([
    { State: QueuedState, label: 'Queued', tone: 'muted' },
    { State: RunningState, label: 'Running', tone: 'active' },
    { State: WaitingState, label: 'Waiting for you', tone: 'decide' },
  ])('$State.name keeps ongoing work open, stoppable, and refreshing', ({ State, label, tone }) => {
    expect(new State().describe()).toEqual({
      label,
      tone,
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    });
  });

  it.each([
    { State: FinishedState, label: 'Finished', tone: 'keep' },
    { State: StoppedState, label: 'Stopped', tone: 'gap' },
    { State: FailedState, label: 'Failed', tone: 'gap' },
  ])(
    '$State.name keeps results accessible without stopping or polling',
    ({ State, label, tone }) => {
      expect(new State().describe()).toEqual({
        label,
        tone,
        actions: ['open-session'],
        refreshPolicy: 'stop',
      });
    },
  );
});
