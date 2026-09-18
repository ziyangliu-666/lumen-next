import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@lumen/contracts';
import type { Worker } from '../../core/domain/worker.js';
import type { Principal } from '../../core/http/authGuard.js';
import { HttpError } from '../../core/http/httpError.js';
import { Broker } from '../../core/protocol/broker.js';
import { Delegation } from './delegation.js';
import { demoWorker } from './demoWorker.js';
import { Kernel } from './kernel.js';
import { MemoryTrace } from './memoryTrace.js';

const owner: Principal = { accountId: 'acc-1', role: 'user' };
const stranger: Principal = { accountId: 'acc-2', role: 'user' };
const staff: Principal = { accountId: 'acc-3', role: 'staff' };

/** The smallest worker: one reply, no delegation. */
const oneStep: Worker = {
  run: (task, input, report) => report.appendStep(task.id, 'reply', `got "${input}"`),
};

function harness(
  worker: Worker = oneStep,
  delegation?: Delegation,
): { kernel: Kernel; broker: Broker; events: ServerEvent[] } {
  const broker = new Broker();
  const events: ServerEvent[] = [];
  // The session id is not known until start() returns, so record at the source.
  const publish = broker.publish.bind(broker);
  broker.publish = (sessionId: string, event: ServerEvent): void => {
    events.push(event);
    publish(sessionId, event);
  };
  return {
    kernel: new Kernel(new MemoryTrace(), broker, worker, delegation ? { delegation } : {}),
    broker,
    events,
  };
}

describe('session: kernel', () => {
  it('opens a session with its root task and returns it before the worker runs', async () => {
    const { kernel } = harness();
    const snapshot = await kernel.start('p1', owner.accountId, 'what is new in fusion?');

    expect(snapshot.session.projectId).toBe('p1');
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]).toMatchObject({
      parentId: null,
      depth: 0,
      agent: 'lead',
      title: 'what is new in fusion?',
      status: 'queued',
    });
    expect(snapshot.spend).toEqual({ dollars: 0 });
  });

  it('runs the worker on the root with the question as its input, and ends the task', async () => {
    const { kernel } = harness();
    const { session } = await kernel.start('p1', owner.accountId, 'question');
    await kernel.idle();

    const snapshot = await kernel.snapshot(session.id, owner);
    expect(snapshot.tasks[0]?.status).toBe('ended');
    expect(snapshot.tasks[0]?.endedAt).not.toBeNull();
    expect(snapshot.steps).toEqual([
      { taskId: snapshot.tasks[0]?.id, index: 0, kind: 'reply', text: 'got "question"' },
    ]);
  });

  it('publishes every change to the session, in the order it happened', async () => {
    const { kernel, events } = harness();
    await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect(events.map((event) => event.type)).toEqual([
      'task.opened',
      'task.status',
      'step.appended',
      'task.status',
    ]);
  });

  it('marks the task failed when the worker throws, and does not throw itself', async () => {
    const broken: Worker = { run: () => Promise.reject(new Error('no model')) };
    const { kernel } = harness(broken);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect((await kernel.snapshot(session.id, owner)).tasks[0]?.status).toBe('failed');
  });

  it('turns a say into a "you" step on the root and another turn with those words', async () => {
    const { kernel } = harness();
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    await kernel.say(session.id, owner, 'go deeper');
    await kernel.idle();

    const steps = (await kernel.snapshot(session.id, owner)).steps;
    expect(steps.map((step) => [step.kind, step.text])).toEqual([
      ['reply', 'got "q"'],
      ['you', 'go deeper'],
      ['reply', 'got "go deeper"'],
    ]);
  });

  it('answers a stranger with 404, the same as for a session that does not exist', async () => {
    const { kernel } = harness();
    const { session } = await kernel.start('p1', owner.accountId, 'q');

    await expect(kernel.snapshot(session.id, stranger)).rejects.toBeInstanceOf(HttpError);
    await expect(kernel.snapshot('nope', owner)).rejects.toBeInstanceOf(HttpError);
    await expect(kernel.say(session.id, stranger, 'hi')).rejects.toMatchObject({ status: 404 });
    await expect(kernel.stop(session.id, stranger)).rejects.toMatchObject({ status: 404 });
    expect(await kernel.access.canWatch(stranger, session.id)).toBe(false);
    expect(await kernel.access.canWatch(owner, 'nope')).toBe(false);
  });

  it('lets the owner and staff watch, and nobody else', async () => {
    const { kernel } = harness();
    const { session } = await kernel.start('p1', owner.accountId, 'q');

    expect(await kernel.access.canWatch(owner, session.id)).toBe(true);
    expect(await kernel.access.canWatch(staff, session.id)).toBe(true);
    expect((await kernel.snapshot(session.id, staff)).session.accountId).toBe('acc-1');
  });

  it('after a restart, stops every task whose process is gone, and leaves the ended ones', async () => {
    const trace = new MemoryTrace();
    const broker = new Broker();
    const releases: Array<() => void> = [];
    const hung: Worker = { run: () => new Promise<void>((done) => releases.push(done)) };
    const before = new Kernel(trace, broker, hung);
    const { session } = await before.start('p1', owner.accountId, 'q');
    const finished = await before.start('p1', owner.accountId, 'done already');
    await trace.setStatus(finished.tasks[0]!.id, 'ended');

    // The process dies here. A new kernel comes up over the same record.
    const after = new Kernel(trace, broker, oneStep);
    const stopped = await after.restore();

    expect(stopped).toBe(1);
    expect((await after.snapshot(session.id, owner)).tasks[0]?.status).toBe('stopped');
    expect((await after.snapshot(finished.session.id, owner)).tasks[0]?.status).toBe('ended');
    for (const release of releases) release();
    await before.idle();
  });
});

describe('session: kernel, delegation and cost', () => {
  it('fans a question out to child tasks, one level under the lead, and ends them all', async () => {
    const { kernel } = harness(demoWorker);
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    const [lead, ...readers] = tasks;

    expect(readers).toHaveLength(3);
    expect(readers.every((task) => task.parentId === lead?.id && task.depth === 1)).toBe(true);
    expect(readers.map((task) => task.agent)).toEqual(['reader', 'reader', 'reader']);
    expect(tasks.every((task) => task.status === 'ended')).toBe(true);
  });

  it('rolls what the children spent up to the session, and leaves the lead at zero', async () => {
    const { kernel, events } = harness(demoWorker);
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    const snapshot = await kernel.snapshot(session.id, owner);

    expect(snapshot.tasks[0]?.ownCost).toEqual({ dollars: 0 });
    expect(snapshot.spend.dollars).toBeCloseTo(0.03, 6);
    expect(events.filter((event) => event.type === 'task.cost')).toHaveLength(3);
    // Each spend announces a new total for the reader and for the lead above it.
    expect(events.filter((event) => event.type === 'task.total')).toHaveLength(6);
    const lead = snapshot.tasks[0]!;
    expect(snapshot.totals[lead.id]?.dollars).toBeCloseTo(0.03, 6);
    expect(snapshot.totals[snapshot.tasks[1]!.id]?.dollars).toBeCloseTo(0.01, 6);
  });

  it('hands the children back to the lead only when they have come to rest', async () => {
    const { kernel } = harness(demoWorker);
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    const last = steps.filter((step) => step.taskId === tasks[0]?.id).at(-1);

    expect(last?.kind).toBe('reply');
    expect(last?.text).toContain('3 of 3');
  });

  it('a child that fails is a result for the parent, not an exception', async () => {
    const worker: Worker = {
      async run(task, _input, report) {
        if (task.agent === 'reader') throw new Error('tool broke');
        const children = await report.delegate(task.id, [{ agent: 'reader', title: 'part' }]);
        await report.appendStep(task.id, 'reply', `child is ${children[0]?.status}`);
      },
    };
    const { kernel } = harness(worker);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    expect(tasks.map((task) => task.status)).toEqual(['ended', 'failed']);
    expect(steps.at(-1)?.text).toBe('child is failed');
  });

  it('refuses a fan-out deeper than the limit, and the task that asked for it fails', async () => {
    const recursive: Worker = {
      run: async (task, _input, report) => {
        await report.delegate(task.id, [{ agent: 'reader', title: 'deeper' }]);
      },
    };
    const { kernel } = harness(recursive, new Delegation({ maxDepth: 1, maxParallel: 3 }));
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    // Depth 0 delegates to depth 1; depth 1 may not delegate, so it fails, and
    // nothing at depth 2 was ever opened.
    expect(tasks.map((task) => [task.depth, task.status])).toEqual([
      [0, 'ended'],
      [1, 'failed'],
    ]);
  });

  it('stops the whole tree with one call, and a finished task keeps its verdict', async () => {
    const releases: Array<() => void> = [];
    const worker: Worker = {
      async run(task, _input, report) {
        if (task.agent === 'lead') {
          await report.delegate(task.id, [
            { agent: 'quick', title: 'ends at once' },
            { agent: 'slow', title: 'hangs' },
            { agent: 'slow', title: 'waits for a lane' },
          ]);
        } else if (task.agent === 'slow') {
          await new Promise<void>((done) => releases.push(done));
        }
      },
    };
    const { kernel } = harness(worker, new Delegation({ maxDepth: 2, maxParallel: 2 }));
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    // Until the first slow child is inside the worker, with the third queued behind it.
    while (releases.length === 0) await new Promise((done) => setTimeout(done, 1));

    await kernel.stop(session.id, owner);
    for (const release of releases) release();
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    expect(tasks.map((task) => [task.title, task.status])).toEqual([
      ['q', 'stopped'],
      ['ends at once', 'ended'],
      ['hangs', 'stopped'],
      // Never started: a stop that reached it while queued is not undone by a free lane.
      ['waits for a lane', 'stopped'],
    ]);
  });

  it('refuses a spend that is not a non-negative amount', async () => {
    const { kernel } = harness();
    const { tasks } = await kernel.start('p1', owner.accountId, 'q');

    await expect(kernel.addSpend(tasks[0]!.id, { dollars: -1 }, 'refund?')).rejects.toThrow();
    await expect(kernel.addSpend(tasks[0]!.id, { dollars: Number.NaN }, 'x')).rejects.toThrow();
  });

  it('saves a finding before it announces it, with the id the saver gave', async () => {
    const order: string[] = [];
    const broker = new Broker();
    const publish = broker.publish.bind(broker);
    broker.publish = (sessionId: string, event: ServerEvent): void => {
      if (event.type === 'finding.recorded') order.push(`announced ${event.findingId}`);
      publish(sessionId, event);
    };
    const kernel = new Kernel(new MemoryTrace(), broker, oneStep, {
      saveFinding: (sessionId, taskId, text) => {
        order.push('saved');
        return Promise.resolve({ id: 'f-1', sessionId, taskId, text, createdAt: 1 });
      },
    });
    const { tasks } = await kernel.start('p1', owner.accountId, 'q');

    const finding = await kernel.recordFinding(tasks[0]!.id, 'fusion works');

    expect(finding.id).toBe('f-1');
    expect(order).toEqual(['saved', 'announced f-1']);
  });

  it('announces nothing when the finding could not be saved, and refuses one with no text', async () => {
    const broker = new Broker();
    const announced: ServerEvent[] = [];
    const publish = broker.publish.bind(broker);
    broker.publish = (sessionId: string, event: ServerEvent): void => {
      if (event.type === 'finding.recorded') announced.push(event);
      publish(sessionId, event);
    };
    const kernel = new Kernel(new MemoryTrace(), broker, oneStep, {
      saveFinding: () => Promise.reject(new Error('database is down')),
    });
    const { tasks } = await kernel.start('p1', owner.accountId, 'q');

    await expect(kernel.recordFinding(tasks[0]!.id, 'lost')).rejects.toThrow('database is down');
    await expect(kernel.recordFinding(tasks[0]!.id, '   ')).rejects.toThrow(/needs text/);
    await expect(kernel.recordFinding('nope', 'x')).rejects.toThrow(/no task/);
    expect(announced).toEqual([]);
  });

  it('keeps findings in memory when no projects slice is wired, so the demo still runs', async () => {
    const { kernel, events } = harness(demoWorker);
    await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    expect(events.filter((event) => event.type === 'finding.recorded')).toHaveLength(3);
  });

  it('opens a session in the mode it is given, and explores by default', async () => {
    const { kernel } = harness();

    expect((await kernel.start('p1', owner.accountId, 'q')).session.mode).toBe('explore');
    expect((await kernel.start('p1', owner.accountId, 'q', 'seed')).session.mode).toBe('seed');
  });
});
