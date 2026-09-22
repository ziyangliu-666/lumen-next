import { describe, expect, it, vi } from 'vitest';
import type { WorkerReport } from '../../core/domain/worker.js';
import { NoActiveRun, SteerRegistry } from './steerRegistry.js';

// Typed as a record of mocks, not as WorkerReport itself: a variable typed
// with the interface makes `report.appendStep` an "unbound method" as far as
// eslint's rule is concerned, on every read, not just a call. Cast only where
// something asks for the real interface (registry.begin).
interface FakeReport {
  readonly appendStep: ReturnType<typeof vi.fn>;
  readonly delegate: ReturnType<typeof vi.fn>;
  readonly recordFinding: ReturnType<typeof vi.fn>;
  readonly addSpend: ReturnType<typeof vi.fn>;
}

function fakeReport(): FakeReport {
  return {
    appendStep: vi.fn().mockResolvedValue(undefined),
    delegate: vi.fn().mockResolvedValue([]),
    recordFinding: vi.fn(),
    addSpend: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SteerRegistry', () => {
  it('refuses to steer a task with no active run', () => {
    const registry = new SteerRegistry();
    expect(() => registry.steer('task-1', 'hello', 'next-step')).toThrow(NoActiveRun);
  });

  it('queues a steer and delivers it as a "you" step once the worker flushes', () => {
    const registry = new SteerRegistry();
    const report = fakeReport();
    const queue = registry.begin('task-1', report as unknown as WorkerReport);

    registry.steer('task-1', 'change course', 'next-step');
    expect(queue.size).toBe(1);

    queue.flush('next-step');

    expect(report.appendStep).toHaveBeenCalledWith('task-1', 'you', 'change course');
    expect(queue.size).toBe(0);
  });

  it('does not deliver a steer queued for the other moment', () => {
    const registry = new SteerRegistry();
    const report = fakeReport();
    const queue = registry.begin('task-1', report as unknown as WorkerReport);

    registry.steer('task-1', 'wait for the end', 'end-of-turn');
    queue.flush('next-step');

    expect(report.appendStep).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);
  });

  it('refuses a steer once the run has ended', () => {
    const registry = new SteerRegistry();
    registry.begin('task-1', fakeReport() as unknown as WorkerReport);
    registry.end('task-1');

    expect(() => registry.steer('task-1', 'too late', 'next-step')).toThrow(NoActiveRun);
  });

  it('keeps two tasks independent', () => {
    const registry = new SteerRegistry();
    const reportA = fakeReport();
    const reportB = fakeReport();
    const queueA = registry.begin('task-a', reportA as unknown as WorkerReport);
    registry.begin('task-b', reportB as unknown as WorkerReport);

    registry.steer('task-a', 'for a', 'end-of-turn');
    queueA.flush('end-of-turn');

    expect(reportA.appendStep).toHaveBeenCalledWith('task-a', 'you', 'for a');
    expect(reportB.appendStep).not.toHaveBeenCalled();
  });
});
