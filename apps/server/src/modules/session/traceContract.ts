import { expect, it } from 'vitest';
import type { Trace } from './trace.js';

// What any Trace promises, written once and run against both implementations
// (trace.test.ts). MemoryTrace is what the kernel's unit tests run on, so if it
// drifted from PgTrace those tests would pass against behaviour production
// does not have.
export function traceContract(make: () => Trace): void {
  it('opens a session and reads it back', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');

    expect(await trace.session(session.id)).toEqual(session);
    expect(session).toMatchObject({ projectId: 'p1', accountId: 'acc-1', mode: 'explore' });
  });

  it('keeps the model a session was opened with, and none when it chose none', async () => {
    const trace = make();
    const chosen = await trace.openSession('p1', 'acc-1', 'seed', 'gpt-4.1-mini');
    const plain = await trace.openSession('p1', 'acc-1', 'seed');

    expect((await trace.session(chosen.id))?.model).toBe('gpt-4.1-mini');
    expect(await trace.session(plain.id)).not.toHaveProperty('model');
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
    const session = await trace.openSession('p1', 'acc-1', 'explore');
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
    const session = await trace.openSession('p1', 'acc-1', 'explore');

    await expect(
      trace.openTask(session.id, '00000000-0000-4000-8000-000000000000', 'reader', 'orphan'),
    ).rejects.toThrow(/no parent task/);
  });

  it('stamps endedAt on an ending status and clears it when the task runs again', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    expect((await trace.setStatus(root.id, 'running')).endedAt).toBeNull();
    expect((await trace.setStatus(root.id, 'ended')).endedAt).not.toBeNull();
    expect((await trace.setStatus(root.id, 'running')).endedAt).toBeNull();
    await expect(trace.setStatus('nope', 'ended')).rejects.toThrow(/no task/);
  });

  it('numbers the steps of a task from 0, also when two arrive together', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    const steps = await Promise.all([
      trace.appendStep(root.id, 'thinking', 'a'),
      trace.appendStep(root.id, 'tool', 'b'),
      trace.appendStep(root.id, 'reply', 'c'),
    ]);

    expect(steps.map((step) => step.index).sort()).toEqual([0, 1, 2]);
    await expect(trace.appendStep('nope', 'reply', 'x')).rejects.toThrow(/no task/);
  });

  it('reads a snapshot with the tasks in the order they were opened and their steps', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const other = await trace.openSession('p2', 'acc-2', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');
    const child = await trace.openTask(session.id, root.id, 'reader', 'part');
    await trace.openTask(other.id, null, 'lead', 'not mine');
    await trace.appendStep(root.id, 'thinking', 'planning');
    await trace.appendStep(child.id, 'tool', 'reading');

    const snapshot = await trace.snapshot(session.id);

    expect(snapshot?.session.id).toBe(session.id);
    expect(snapshot?.tasks.map((task) => task.id)).toEqual([root.id, child.id]);
    expect(snapshot?.steps).toEqual([
      { taskId: root.id, index: 0, kind: 'thinking', text: 'planning' },
      { taskId: child.id, index: 0, kind: 'tool', text: 'reading' },
    ]);
  });

  it('keeps what a task waits for, finds the task by its approval, and clears it', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const task = await trace.openTask(session.id, null, 'lead', 'q');
    const pending = {
      attemptId: 'attempt-1',
      approvalId: 'approval-1',
      at: 'fan-out' as const,
      input: 'delegate 2',
      work: [
        { agent: 'reader', title: 'a' },
        { agent: 'reader', title: 'b' },
      ],
    };
    expect((await trace.setPending(task.id, pending)).pending).toEqual(pending);
    expect((await trace.task(task.id))?.pending).toEqual(pending);
    expect((await trace.taskByApproval('approval-1'))?.id).toBe(task.id);
    expect(await trace.taskByApproval('approval-9')).toBeNull();
    expect((await trace.setPending(task.id, null)).pending).toBeUndefined();
    expect(await trace.taskByApproval('approval-1')).toBeNull();
  });

  it('lists the tasks that have not ended, across sessions', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const running = await trace.openTask(session.id, null, 'lead', 'running');
    const ended = await trace.openTask(session.id, running.id, 'reader', 'ended');
    await trace.setStatus(running.id, 'running');
    await trace.setStatus(ended.id, 'ended');

    const open = (await trace.openTasks()).map((task) => task.id);

    expect(open).toContain(running.id);
    expect(open).not.toContain(ended.id);
  });

  it("adds a spend to the task's own cost, exactly, also when two arrive together", async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    await Promise.all([
      trace.addCost(root.id, { dollars: 0.01 }),
      trace.addCost(root.id, { dollars: 0.02 }),
    ]);
    const after = await trace.addCost(root.id, { dollars: 0.0005 });

    expect(after.ownCost.dollars).toBeCloseTo(0.0305, 6);
    await expect(trace.addCost('nope', { dollars: 1 })).rejects.toThrow(/no task/);
  });

  it('summarises the sessions of one project, newest first, with status and spend', async () => {
    const trace = make();
    const project = `p-${Math.random()}`;
    const first = await trace.openSession(project, 'acc-1', 'explore');
    const second = await trace.openSession(project, 'acc-1', 'seed');
    await trace.openSession('another project', 'acc-1', 'explore');
    const root = await trace.openTask(first.id, null, 'lead', 'q');
    const child = await trace.openTask(first.id, root.id, 'reader', 'part');
    await trace.addCost(root.id, { dollars: 0.01 });
    await trace.addCost(child.id, { dollars: 0.02 });
    await trace.setStatus(root.id, 'ended');

    const summaries = await trace.summaries(project);

    expect(summaries.map((summary) => summary.id).sort()).toEqual([first.id, second.id].sort());
    const done = summaries.find((summary) => summary.id === first.id);
    expect(done).toMatchObject({ mode: 'explore', status: 'ended' });
    expect(done?.spend.dollars).toBeCloseTo(0.03, 6);
    expect(done?.endedAt).not.toBeNull();
    // A session whose root has not been opened yet is queued and has spent nothing.
    expect(summaries.find((summary) => summary.id === second.id)).toMatchObject({
      mode: 'seed',
      status: 'queued',
      spend: { dollars: 0 },
      endedAt: null,
    });
    expect(await trace.summaries('no such project')).toEqual([]);
  });

  it('reads a step back with exactly the detail it was given, and with none when none was given', async () => {
    const trace = make();
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');
    const detail = {
      tool: 'search',
      durationMs: 6000,
      cost: { dollars: 0.01 },
      // An array inside the detail: a driver that sent it as a Postgres array
      // instead of as JSON would fail here.
      rows: [
        { source: 'arxiv', text: 'permutation statistics', result: '41 papers' },
        { source: 'oeis', text: 'pop-stack preimages', result: 'nothing', empty: true },
      ],
      output: 'line one\nline "two" with quotes, a \\ backslash and a \u2713',
      childTaskIds: ['00000000-0000-4000-8000-000000000001'],
    };

    const written = await trace.appendStep(root.id, 'tool', 'search: x', detail);
    const plain = await trace.appendStep(root.id, 'reply', 'done');
    const read = (await trace.snapshot(session.id))?.steps;

    expect(written.detail).toEqual(detail);
    expect(read?.[0]?.detail).toEqual(detail);
    // Absent, not null and not {}: the contract says optional.
    expect(plain).not.toHaveProperty('detail');
    expect(read?.[1]).not.toHaveProperty('detail');
  });
}
