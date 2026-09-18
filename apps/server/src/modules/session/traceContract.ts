import { expect, it } from 'vitest';
import type { Trace } from './trace.js';

// What any Trace promises, written once and run against both implementations
// (trace.test.ts). MemoryTrace is what the kernel's unit tests run on, so if it
// drifted from PgTrace those tests would pass against behaviour production
// does not have.
export function traceContract(make: () => Trace): void {
  it('opens a session and reads it back', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');

    expect(await trace.session(session.id)).toEqual(session);
    expect(session).toMatchObject({ projectId: 'p1', accountId: 'acc-1' });
  });

  it('answers null for an id that names nothing, uuid or not', async () => {
    const trace = make();

    expect(await trace.session('nope')).toBeNull();
    expect(await trace.session('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await trace.task('nope')).toBeNull();
    expect(await trace.rootOf('nope')).toBeNull();
    expect(await trace.snapshot('nope')).toBeNull();
  });

  it('opens the root queued at depth 0, and a child one level under its parent', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');
    const root = await trace.openTask(session.id, null, 'lead', 'question');
    const child = await trace.openTask(session.id, root.id, 'reader', 'part one');

    expect(root).toMatchObject({ parentId: null, depth: 0, status: 'queued', endedAt: null });
    expect(root.ownCost).toEqual({ dollars: 0 });
    expect(child).toMatchObject({ parentId: root.id, depth: 1, agent: 'reader' });
    expect((await trace.task(root.id))?.childIds).toEqual([child.id]);
    expect((await trace.rootOf(session.id))?.id).toBe(root.id);
  });

  it('refuses a child whose parent does not exist', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');

    await expect(
      trace.openTask(session.id, '00000000-0000-4000-8000-000000000000', 'reader', 'orphan'),
    ).rejects.toThrow(/no parent task/);
  });

  it('stamps endedAt on an ending status and clears it when the task runs again', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    expect((await trace.setStatus(root.id, 'running')).endedAt).toBeNull();
    expect((await trace.setStatus(root.id, 'ended')).endedAt).not.toBeNull();
    expect((await trace.setStatus(root.id, 'running')).endedAt).toBeNull();
    await expect(trace.setStatus('nope', 'ended')).rejects.toThrow(/no task/);
  });

  it('numbers the steps of a task from 0, also when two arrive together', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    const steps = await Promise.all([
      trace.appendStep(root.id, 'a'),
      trace.appendStep(root.id, 'b'),
      trace.appendStep(root.id, 'c'),
    ]);

    expect(steps.map((step) => step.index).sort()).toEqual([0, 1, 2]);
    await expect(trace.appendStep('nope', 'x')).rejects.toThrow(/no task/);
  });

  it('reads a snapshot with the tasks in the order they were opened and their steps', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');
    const other = await trace.openSession('p2', 'acc-2');
    const root = await trace.openTask(session.id, null, 'lead', 'q');
    const child = await trace.openTask(session.id, root.id, 'reader', 'part');
    await trace.openTask(other.id, null, 'lead', 'not mine');
    await trace.appendStep(root.id, 'thinking');
    await trace.appendStep(child.id, 'reading');

    const snapshot = await trace.snapshot(session.id);

    expect(snapshot?.session.id).toBe(session.id);
    expect(snapshot?.tasks.map((task) => task.id)).toEqual([root.id, child.id]);
    expect(snapshot?.steps).toEqual([
      { taskId: root.id, index: 0, text: 'thinking' },
      { taskId: child.id, index: 0, text: 'reading' },
    ]);
  });

  it('lists the tasks that have not ended, across sessions', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1');
    const running = await trace.openTask(session.id, null, 'lead', 'running');
    const ended = await trace.openTask(session.id, running.id, 'reader', 'ended');
    await trace.setStatus(running.id, 'running');
    await trace.setStatus(ended.id, 'ended');

    const open = (await trace.openTasks()).map((task) => task.id);

    expect(open).toContain(running.id);
    expect(open).not.toContain(ended.id);
  });
}
