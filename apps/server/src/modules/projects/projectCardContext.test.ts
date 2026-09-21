import type { TaskStatus } from '@lumen/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ProjectCardContext } from './projectCardContext.js';

describe('ProjectCardContext', () => {
  it('changes Stop execution and cadence only after an authoritative update', async () => {
    const command = vi.fn().mockResolvedValue(undefined);
    const context = new ProjectCardContext({ status: 'waiting' });
    expect(context.pollDelay()).toBe(15000);
    expect(await context.stop(command)).toBe('stop_requested');
    expect(context.describe().label).toBe('Waiting for you');
    context.applySummary({ status: 'ended' });
    expect(await context.stop(command)).toBe('already_terminal');
    expect(context.pollDelay()).toBeNull();
    expect(command).toHaveBeenCalledTimes(1);
  });
  const expected = {
    queued: {
      label: 'Queued',
      tone: 'muted',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    },
    running: {
      label: 'Running',
      tone: 'active',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    },
    waiting: {
      label: 'Waiting for you',
      tone: 'decide',
      actions: ['open-session', 'stop'],
      refreshPolicy: 'continue',
    },
    ended: { label: 'Finished', tone: 'keep', actions: ['open-session'], refreshPolicy: 'stop' },
    stopped: { label: 'Stopped', tone: 'gap', actions: ['open-session'], refreshPolicy: 'stop' },
    failed: { label: 'Failed', tone: 'gap', actions: ['open-session'], refreshPolicy: 'stop' },
  } satisfies Record<TaskStatus, unknown>;

  it.each(Object.keys(expected) as TaskStatus[])(
    'restores a confirmed %s snapshot directly',
    (status) => {
      expect(new ProjectCardContext({ status }).describe()).toEqual(expected[status]);
    },
  );

  it('updates label, actions, and refresh together as work waits, resumes, and finishes', () => {
    const context = new ProjectCardContext({ status: 'queued' });
    const sequence: TaskStatus[] = ['running', 'waiting', 'running', 'ended'];
    for (const status of sequence) {
      context.applySummary({ status });
      expect(context.describe()).toEqual(expected[status]);
    }
  });

  it.each(['stopped', 'failed'] as const)(
    'removes Stop and polling only after confirmed %s',
    (status) => {
      const context = new ProjectCardContext({ status: 'running' });
      const before = context.describe();
      context.applySummary({ status });
      expect(context.describe()).toEqual(expected[status]);
      expect(before).toEqual(expected.running);
    },
  );

  it('accepts skipped transitions and a newly selected active session after a terminal snapshot', () => {
    const context = new ProjectCardContext({ status: 'queued' });
    context.applySummary({ status: 'ended' });
    expect(context.describe()).toEqual(expected.ended);
    context.applySummary({ status: 'waiting' });
    expect(context.describe()).toEqual(expected.waiting);
  });

  it('retains confirmed status while a stop request or failed fetch supplies no new summary', () => {
    const summary: { status: TaskStatus } = { status: 'running' };
    const context = new ProjectCardContext(summary);
    // Mutating a caller's cached object is not confirmation delivered to the context.
    summary.status = 'stopped';
    expect(context.describe()).toEqual(expected.running);
    expect(context.describe()).toEqual(expected.running);
    context.applySummary(summary);
    expect(context.describe()).toEqual(expected.stopped);
  });

  it('applies an identical snapshot idempotently', () => {
    const context = new ProjectCardContext({ status: 'waiting' });
    context.applySummary({ status: 'waiting' });
    expect(context.describe()).toEqual(expected.waiting);
  });
});
