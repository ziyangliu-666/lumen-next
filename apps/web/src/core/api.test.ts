import { describe, expect, it } from 'vitest';
import type { SessionSnapshot, Task } from '@lumen/contracts';
import { apply, type SessionState } from './api';

const task = (id: string, parentId: string | null): Task => ({
  id,
  sessionId: 's1',
  parentId,
  agent: parentId ? 'reader' : 'lead',
  title: id,
  depth: parentId ? 1 : 0,
  status: 'ended',
  ownCost: { dollars: 0 },
  startedAt: 1_000,
  endedAt: 2_000,
});

const snapshot: SessionSnapshot = {
  session: { id: 's1', mode: 'explore', projectId: 'p1', accountId: 'a1', startedAt: 1_000 },
  tasks: [task('lead', null)],
  steps: [],
  totals: {},
  spend: { dollars: 0 },
};
const state: SessionState = { snapshot, findings: [], stream: 'open' };

describe('web core: applying events to the session state', () => {
  it('clears endedAt when a task runs again, and stamps it when the task ends', () => {
    const running = apply(state, { type: 'task.status', taskId: 'lead', status: 'running' });
    expect(running.snapshot.tasks[0]).toMatchObject({ status: 'running', endedAt: null });

    const ended = apply(running, { type: 'task.status', taskId: 'lead', status: 'ended' });
    expect(ended.snapshot.tasks[0]?.endedAt).toBeGreaterThan(2_000);
  });

  it('keeps a task, a step and a finding once, however often they are announced', () => {
    const opened = { type: 'task.opened', task: task('r1', 'lead') } as const;
    const step = {
      type: 'step.appended',
      taskId: 'lead',
      index: 0,
      kind: 'reply',
      text: 'x',
    } as const;
    const finding = {
      type: 'finding.recorded',
      taskId: 'r1',
      findingId: 'f1',
      text: 'kept',
    } as const;

    const twice = [opened, opened, step, step, finding, finding].reduce(apply, state);

    expect(twice.snapshot.tasks).toHaveLength(2);
    expect(twice.snapshot.steps).toHaveLength(1);
    expect(twice.findings).toEqual([{ id: 'f1', taskId: 'r1', text: 'kept' }]);
  });

  it('keeps what a step carried, not only its line of text', () => {
    const detail = {
      tool: 'search',
      durationMs: 6000,
      cost: { dollars: 0.01 },
      rows: [{ source: 'oeis', text: 'pop-stack preimages', result: 'nothing', empty: true }],
    };
    const next = apply(state, {
      type: 'step.appended',
      taskId: 'lead',
      index: 0,
      kind: 'tool',
      text: 'search: x',
      detail,
    });

    expect(next.snapshot.steps[0]).toEqual({
      taskId: 'lead',
      index: 0,
      kind: 'tool',
      text: 'search: x',
      detail,
    });
  });

  it('takes the session spend from the total of the root, and from nowhere else', () => {
    const child = apply(state, { type: 'task.total', taskId: 'r1', total: { dollars: 0.01 } });
    expect(child.snapshot.spend).toEqual({ dollars: 0 });

    const root = apply(child, { type: 'task.total', taskId: 'lead', total: { dollars: 0.03 } });
    expect(root.snapshot.spend).toEqual({ dollars: 0.03 });
  });

  it('replaces everything with a snapshot of this session, and ignores one of another', () => {
    const fresh = { ...snapshot, spend: { dollars: 9 } };
    expect(apply(state, { type: 'session.snapshot', snapshot: fresh }).snapshot.spend.dollars).toBe(
      9,
    );

    const other = { ...fresh, session: { ...fresh.session, id: 's2' } };
    expect(apply(state, { type: 'session.snapshot', snapshot: other })).toBe(state);
  });

  it('ignores an event it does not know, so an older page survives a newer server', () => {
    expect(apply(state, { type: 'error', message: 'x' })).toBe(state);
  });
});
