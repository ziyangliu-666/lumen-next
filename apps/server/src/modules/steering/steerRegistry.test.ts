import { describe, expect, it } from 'vitest';
import { NoActiveRun, SteerRegistry } from './steerRegistry.js';

/** A sink that only remembers what reached it, in order. */
function inbox(): { readonly landed: string[]; readonly sink: (text: string) => void } {
  const landed: string[] = [];
  return { landed, sink: (text) => landed.push(text) };
}

describe('SteerRegistry', () => {
  it('refuses to steer a task with no active run', () => {
    const registry = new SteerRegistry();
    expect(() => registry.steer('task-1', 'hello', 'next-step')).toThrow(NoActiveRun);
  });

  it('queues a steer and hands it to the sink once the worker flushes', () => {
    const registry = new SteerRegistry();
    const { landed, sink } = inbox();
    const queue = registry.begin('task-1', sink);

    registry.steer('task-1', 'change course', 'next-step');
    expect(queue.size).toBe(1);
    expect(landed).toEqual([]);

    queue.flush('next-step');

    expect(landed).toEqual(['change course']);
    expect(queue.size).toBe(0);
  });

  it('does not deliver a steer queued for the other moment', () => {
    const registry = new SteerRegistry();
    const { landed, sink } = inbox();
    const queue = registry.begin('task-1', sink);

    registry.steer('task-1', 'wait for the end', 'end-of-turn');
    queue.flush('next-step');

    expect(landed).toEqual([]);
    expect(queue.size).toBe(1);
  });

  it('refuses a steer once the run has ended', () => {
    const registry = new SteerRegistry();
    registry.begin('task-1', () => undefined);
    registry.end('task-1');

    expect(() => registry.steer('task-1', 'too late', 'next-step')).toThrow(NoActiveRun);
  });

  it('leaves what was queued before end() with the queue, for the worker to drain', () => {
    const registry = new SteerRegistry();
    const { landed, sink } = inbox();
    const queue = registry.begin('task-1', sink);

    registry.steer('task-1', 'just in time', 'next-step');
    registry.end('task-1');
    queue.flush('next-step');

    expect(landed).toEqual(['just in time']);
  });

  it('keeps two tasks independent', () => {
    const registry = new SteerRegistry();
    const a = inbox();
    const b = inbox();
    const queueA = registry.begin('task-a', a.sink);
    registry.begin('task-b', b.sink);

    registry.steer('task-a', 'for a', 'end-of-turn');
    queueA.flush('end-of-turn');

    expect(a.landed).toEqual(['for a']);
    expect(b.landed).toEqual([]);
  });
});
