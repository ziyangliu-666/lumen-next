import type { TaskStatus } from '@lumen/contracts';
import { describe, expect, it } from 'vitest';
import { ProjectCardContext } from './projectCardContext.js';

describe('ProjectCardContext', () => {
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
