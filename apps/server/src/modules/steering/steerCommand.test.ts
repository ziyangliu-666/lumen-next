import { describe, expect, it, vi } from 'vitest';
import { AlreadyLandedError, SteerCommand, SteerQueue } from './steerCommand.js';

function command(
  id: string,
  taskId: string,
  when: 'end-of-turn' | 'next-step',
  sink = vi.fn(),
): { command: SteerCommand; sink: typeof sink } {
  return { command: new SteerCommand(id, taskId, `text-${id}`, when, sink), sink };
}

describe('SteerCommand', () => {
  it('delivers to the sink when applied', () => {
    const { command: cmd, sink } = command('s1', 't1', 'next-step');

    cmd.apply();

    expect(sink).toHaveBeenCalledWith('t1', 'text-s1');
    expect(cmd.hasLanded).toBe(true);
  });

  it('is idempotent: a second apply does not deliver twice', () => {
    const { command: cmd, sink } = command('s1', 't1', 'next-step');

    cmd.apply();
    cmd.apply();

    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('undoes cleanly before it lands', () => {
    const { command: cmd, sink } = command('s1', 't1', 'next-step');

    expect(() => cmd.undo()).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it('refuses to undo a command that already landed', () => {
    const { command: cmd } = command('s1', 't1', 'next-step');

    cmd.apply();

    expect(() => cmd.undo()).toThrow(AlreadyLandedError);
  });
});

describe('SteerQueue', () => {
  it('flushes only the commands for the requested moment', () => {
    const queue = new SteerQueue();
    const { command: endOfTurn, sink: endSink } = command('a', 't1', 'end-of-turn');
    const { command: nextStep, sink: stepSink } = command('b', 't1', 'next-step');
    queue.enqueue(endOfTurn);
    queue.enqueue(nextStep);

    queue.flush('next-step');

    expect(stepSink).toHaveBeenCalledTimes(1);
    expect(endSink).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);
  });

  it('removes a command from the queue once it lands', () => {
    const queue = new SteerQueue();
    const { command: cmd } = command('a', 't1', 'next-step');
    queue.enqueue(cmd);

    queue.flush('next-step');

    expect(queue.list()).toEqual([]);
  });

  it('cancels a pending command without delivering it', () => {
    const queue = new SteerQueue();
    const { command: cmd, sink } = command('a', 't1', 'next-step');
    queue.enqueue(cmd);

    const cancelled = queue.cancel('a');
    queue.flush('next-step');

    expect(cancelled).toBe(true);
    expect(sink).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
  });

  it('reports false for an id that was never queued', () => {
    const queue = new SteerQueue();
    expect(queue.cancel('ghost')).toBe(false);
  });

  it('reports false for a command that already landed', () => {
    const queue = new SteerQueue();
    const { command: cmd } = command('a', 't1', 'next-step');
    queue.enqueue(cmd);
    queue.flush('next-step'); // lands and leaves the queue

    expect(queue.cancel('a')).toBe(false);
  });

  it('keeps commands for the other moment across a flush', () => {
    const queue = new SteerQueue();
    const { command: first } = command('a', 't1', 'next-step');
    queue.enqueue(first);

    queue.flush('end-of-turn'); // nothing here is due yet

    expect(queue.size).toBe(1);
    expect(queue.list()[0]?.id).toBe('a');
  });

  it('list() is a snapshot: mutating it does not touch the queue', () => {
    const queue = new SteerQueue();
    const { command: cmd } = command('a', 't1', 'next-step');
    queue.enqueue(cmd);

    const snapshot = queue.list() as SteerCommand[];
    snapshot.pop();

    expect(queue.size).toBe(1);
  });
});
