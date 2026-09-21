import { describe, expect, it, vi } from 'vitest';
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
    { State: QueuedState, delay: 5000 },
    { State: RunningState, delay: 5000 },
    { State: WaitingState, delay: 15000 },
  ])('$State.name executes Stop and chooses its polling cadence', async ({ State, delay }) => {
    const state = new State();
    const command = vi.fn().mockResolvedValue(undefined);
    expect(await state.stop(command)).toBe('stop_requested');
    expect(command).toHaveBeenCalledTimes(1);
    expect(state.pollDelay()).toBe(delay);
    command.mockRejectedValue(new Error('unavailable'));
    await expect(state.stop(command)).rejects.toThrow('unavailable');
    expect(state.describe().actions).toContain('stop');
  });
  it.each([FinishedState, StoppedState, FailedState])(
    '%s refuses a terminal Stop without calling the session and stops polling',
    async (State) => {
      const state = new State();
      const command = vi.fn().mockResolvedValue(undefined);
      expect(await state.stop(command)).toBe('already_terminal');
      expect(command).not.toHaveBeenCalled();
      expect(state.pollDelay()).toBeNull();
    },
  );
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
