import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@lumen/contracts';
import type { BudgetGuard, Charge, Decision } from '../../core/domain/budget.js';
import type { Worker } from '../../core/domain/worker.js';
import type { Principal } from '../../core/http/authGuard.js';
import { HttpError } from '../../core/http/httpError.js';
import { capture } from '../../core/log/testLog.js';
import { Broker } from '../../core/protocol/broker.js';
import { Delegation } from './delegation.js';
import { demoWorker } from './demoWorker.js';
import { Kernel, withConversation } from './kernel.js';
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

  it('logs a task started, ended or failed, with the ids on every line and the worker given the same log', async () => {
    const { log, lines } = capture();
    const seen: string[] = [];
    const worker: Worker = {
      run: (task, _input, report) => {
        report.log.info('worker line');
        seen.push(task.id);
        return task.agent === 'lead' ? Promise.resolve() : Promise.reject(new Error('boom'));
      },
    };
    const kernel = new Kernel(new MemoryTrace(), new Broker(), worker, { log });
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const root = seen[0];
    expect(lines()).toMatchObject([
      {
        sessionId: session.id,
        taskId: root,
        accountId: owner.accountId,
        agent: 'lead',
        msg: 'task started',
      },
      { sessionId: session.id, taskId: root, msg: 'worker line' },
      { sessionId: session.id, taskId: root, status: 'ended', msg: 'task ended' },
    ]);
    expect(lines()[2]).toHaveProperty('durationMs');

    const failing = new Kernel(
      new MemoryTrace(),
      new Broker(),
      { run: () => Promise.reject(new Error('boom')) },
      { log },
    );
    await failing.start('p1', owner.accountId, 'q');
    await failing.idle();
    expect(lines().at(-1)).toMatchObject({ msg: 'task failed', err: { message: 'boom' } });
  });

  it('marks the task failed when the worker throws, and does not throw itself', async () => {
    const broken: Worker = { run: () => Promise.reject(new Error('no model')) };
    const { kernel } = harness(broken);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect((await kernel.snapshot(session.id, owner)).tasks[0]?.status).toBe('failed');
  });

  it('turns a say into a "you" step on the root and another turn given the conversation so far', async () => {
    const { kernel } = harness();
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    await kernel.say(session.id, owner, 'go deeper');
    await kernel.idle();

    const steps = (await kernel.snapshot(session.id, owner)).steps;
    expect(steps.map((step) => [step.kind, step.text])).toEqual([
      ['reply', 'got "q"'],
      ['you', 'go deeper'],
      // The follow-up turn knows what came before: without it, "go deeper"
      // reached a worker that no longer knew the question.
      [
        'reply',
        'got "The conversation so far:\n\nUser: q\nYou: got "q"\n\nThe user now says: go deeper"',
      ],
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
    // Both runs must be inside the worker before the record is changed under
    // them, or the run's own "running" lands after the "ended" written here.
    while (releases.length < 2) await new Promise((done) => setTimeout(done, 1));
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
    const { kernel } = harness(demoWorker());
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
    const { kernel, events } = harness(demoWorker());
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
    const { kernel } = harness(demoWorker());
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

  it('keeps a stop when the turn it interrupted then tries to delegate', async () => {
    let release = (): void => undefined;
    const worker: Worker = {
      async run(task, _input, report) {
        // A model call in flight when the stop lands, which then asks for a reader.
        await new Promise<void>((done) => (release = done));
        await report.delegate(task.id, [{ agent: 'reader', title: 'too late' }]);
      },
    };
    const { kernel } = harness(worker);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await new Promise((done) => setTimeout(done, 5));

    await kernel.stop(session.id, owner);
    release();
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    expect(tasks.map((task) => [task.title, task.status])).toEqual([['q', 'stopped']]);
  });

  it('refuses a spend that is not a non-negative amount', async () => {
    const { kernel } = harness();
    const { tasks } = await kernel.start('p1', owner.accountId, 'q');

    await expect(kernel.addSpend(tasks[0]!.id, { dollars: -1 }, 'refund?')).rejects.toThrow();
    await expect(kernel.addSpend(tasks[0]!.id, { dollars: Number.NaN }, 'x')).rejects.toThrow();
  });

  it('records a float artefact as the six decimals it stands for, and does not fail the task', async () => {
    const { kernel } = harness();
    const { session, tasks } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    await kernel.addSpend(tasks[0]!.id, { dollars: 0.1 + 0.2 }, 'two tools');

    expect((await kernel.snapshot(session.id, owner)).spend).toEqual({ dollars: 0.3 });
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
    const { kernel, events } = harness(demoWorker());
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

describe('session: kernel, what a step carries', () => {
  it('names in the delegate step exactly the tasks that step opened, turn by turn', async () => {
    const { kernel } = harness(demoWorker());
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();
    await kernel.say(session.id, owner, 'and in 2026?');
    await kernel.idle();

    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    const lead = tasks[0]!;
    const delegated = steps.filter((step) => step.taskId === lead.id && step.kind === 'delegate');
    const readers = tasks.filter((task) => task.parentId === lead.id).map((task) => task.id);

    // Three on the first turn, one on the second, and between them every reader once.
    expect(delegated.map((step) => step.detail?.childTaskIds?.length)).toEqual([3, 1]);
    expect(delegated.flatMap((step) => step.detail?.childTaskIds ?? [])).toEqual(readers);
  });

  it('charges the cost a step carries to the task, once, and announces both', async () => {
    const worker: Worker = {
      run: (task, _input, report) =>
        report.appendStep(task.id, 'tool', 'search: x', {
          tool: 'search',
          cost: { dollars: 0.1 + 0.2 },
        }),
    };
    const { kernel, events } = harness(worker);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const snapshot = await kernel.snapshot(session.id, owner);
    // Rounded to the column's six decimals on the receipt and on the charge alike.
    expect(snapshot.steps[0]?.detail?.cost).toEqual({ dollars: 0.3 });
    expect(snapshot.tasks[0]?.ownCost).toEqual({ dollars: 0.3 });
    expect(snapshot.spend).toEqual({ dollars: 0.3 });
    expect(events.filter((event) => event.type === 'task.cost')).toHaveLength(1);
  });

  it('writes neither the step nor the charge when the cost is not an amount', async () => {
    const { kernel } = harness();
    const { session, tasks } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    await expect(
      kernel.appendStep(tasks[0]!.id, 'tool', 'search: x', { cost: { dollars: -1 } }),
    ).rejects.toThrow(/non-negative/);

    const after = await kernel.snapshot(session.id, owner);
    expect(after.steps.map((step) => step.kind)).toEqual(['reply']);
    expect(after.spend).toEqual({ dollars: 0 });
  });

  it('does not charge a step whose cost is zero, and does not let a worker name child tasks', async () => {
    const { kernel, events } = harness();
    const { tasks } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    await kernel.appendStep(tasks[0]!.id, 'tool', 'run: free', {
      tool: 'run',
      cost: { dollars: 0 },
    });
    expect(events.filter((event) => event.type === 'task.cost')).toHaveLength(0);

    await expect(
      kernel.appendStep(tasks[0]!.id, 'delegate', 'made up', { childTaskIds: ['not-a-task'] }),
    ).rejects.toThrow(/written by delegate\(\)/);
    // The kind is not what names them: a tool step may not either.
    await expect(
      kernel.appendStep(tasks[0]!.id, 'tool', 'run: x', { childTaskIds: ['not-a-task'] }),
    ).rejects.toThrow(/written by delegate\(\)/);
    await expect(kernel.appendStep(tasks[0]!.id, 'delegate', 'as main did')).rejects.toThrow(
      /written by delegate\(\)/,
    );
  });

  it('sends the detail on the event, so the page draws it without reading the snapshot again', async () => {
    const { kernel, events } = harness(demoWorker());
    await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    const search = events.find(
      (event) => event.type === 'step.appended' && event.detail?.cost !== undefined,
    );
    expect(search).toMatchObject({
      kind: 'tool',
      detail: { tool: 'search', cost: { dollars: 0.01 }, rows: expect.any(Array) as unknown },
    });
    const run = events.find(
      (event) => event.type === 'step.appended' && event.detail?.tool === 'run',
    );
    expect(run?.type === 'step.appended' && run.detail?.output).toContain('$ demo tally');
  });
});

describe('session: kernel, a step and its charge are one write', () => {
  /** A record whose charge fails, as a database that goes away would make it. */
  class ChargeFails extends MemoryTrace {
    override addCost(): Promise<never> {
      return Promise.reject(new Error('ledger is down'));
    }
  }

  it('leaves no receipt when the charge fails: no step, no event, no cost', async () => {
    const broker = new Broker();
    const events: ServerEvent[] = [];
    const publish = broker.publish.bind(broker);
    broker.publish = (sessionId: string, event: ServerEvent): void => {
      events.push(event);
      publish(sessionId, event);
    };
    const worker: Worker = {
      run: (task, _input, report) =>
        report.appendStep(task.id, 'tool', 'search: x', {
          tool: 'search',
          cost: { dollars: 0.01 },
        }),
    };
    const kernel = new Kernel(new ChargeFails(), broker, worker);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const snapshot = await kernel.snapshot(session.id, owner);
    // The page must never show "$0.01" for something nobody was charged for.
    expect(snapshot.steps).toEqual([]);
    expect(snapshot.spend).toEqual({ dollars: 0 });
    expect(snapshot.tasks[0]?.status).toBe('failed');
    expect(events.map((event) => event.type)).not.toContain('step.appended');
    expect(events.map((event) => event.type)).not.toContain('task.cost');
  });

  it('announces the step before its cost, and both only after the write', async () => {
    const worker: Worker = {
      run: (task, _input, report) =>
        report.appendStep(task.id, 'tool', 'search: x', {
          tool: 'search',
          cost: { dollars: 0.01 },
        }),
    };
    const { kernel, events } = harness(worker);
    await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const types = events.map((event) => event.type);
    expect(types.indexOf('step.appended')).toBeLessThan(types.indexOf('task.cost'));
    expect(types.indexOf('task.cost')).toBeLessThan(types.indexOf('task.total'));
  });

  it('makes the text of a step storable before it is written', async () => {
    const { kernel } = harness();
    const { session, tasks } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    const nul = String.fromCharCode(0);

    await kernel.appendStep(tasks[0]!.id, 'tool', `run: a${nul}b`, { output: `x${nul}y` });

    const step = (await kernel.snapshot(session.id, owner)).steps.at(-1);
    expect(step?.text).toBe('run: ab');
    expect(step?.detail?.output).toBe('xy');
  });
});

describe('session: kernel, the delegate step', () => {
  it('is on the record, naming the children, before the first child runs', async () => {
    const seen: (readonly string[] | undefined)[] = [];
    let kernel: Kernel | null = null;
    let sessionId = '';
    const worker: Worker = {
      async run(task, _input, report) {
        if (task.agent === 'lead') {
          await report.delegate(task.id, [
            { agent: 'reader', title: 'one' },
            { agent: 'reader', title: 'two' },
          ]);
          return;
        }
        // What a page that joins now would be sent.
        const now = await kernel!.snapshot(sessionId, owner);
        seen.push(now.steps.find((step) => step.kind === 'delegate')?.detail?.childTaskIds);
      },
    };
    kernel = harness(worker).kernel;
    const started = await kernel.start('p1', owner.accountId, 'q');
    sessionId = started.session.id;
    await kernel.idle();

    const children = (await kernel.snapshot(sessionId, owner)).tasks
      .slice(1)
      .map((task) => task.id);
    expect(seen).toEqual([children, children]);
  });

  it('stops the children it opened when the delegate step cannot be written, and tells the parent', async () => {
    class DelegateStepFails extends MemoryTrace {
      override appendStep(
        ...args: Parameters<MemoryTrace['appendStep']>
      ): ReturnType<MemoryTrace['appendStep']> {
        if (args[1] === 'delegate') return Promise.reject(new Error('disk is full'));
        return super.appendStep(...args);
      }
    }
    const kernel = new Kernel(new DelegateStepFails(), new Broker(), demoWorker());
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    // Nothing is left queued for the life of the process.
    expect(tasks.map((task) => [task.agent, task.status])).toEqual([
      ['lead', 'failed'],
      ['reader', 'stopped'],
      ['reader', 'stopped'],
      ['reader', 'stopped'],
    ]);
  });

  it('stops the children it did open when the record fails part way through the fan-out', async () => {
    class SecondChildFails extends MemoryTrace {
      private opened = 0;
      override openTask(
        ...args: Parameters<MemoryTrace['openTask']>
      ): ReturnType<MemoryTrace['openTask']> {
        // The root is the first task opened, so the second child is the third.
        this.opened += 1;
        if (this.opened === 3) return Promise.reject(new Error('connection lost'));
        return super.openTask(...args);
      }
    }
    const kernel = new Kernel(new SecondChildFails(), new Broker(), demoWorker());
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    expect(tasks.map((task) => [task.agent, task.status])).toEqual([
      ['lead', 'failed'],
      ['reader', 'stopped'],
    ]);
  });
});

describe('session: kernel, the three budget check points', () => {
  /** A guard that records what it was asked and answers from a script. */
  function scripted(answer: (charge: Charge) => Decision | Error): {
    guard: BudgetGuard;
    asked: Charge[];
  } {
    const asked: Charge[] = [];
    return {
      asked,
      guard: {
        check: (charge) => {
          asked.push(charge);
          const result = answer(charge);
          return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        },
      },
    };
  }
  const withGuard = (guard: BudgetGuard, worker: Worker = demoWorker()): Kernel =>
    new Kernel(new MemoryTrace(), new Broker(), worker, { budget: guard });

  it('asks at a turn, at the fan-out and as each delegated task opens, for the owner of the session', async () => {
    const { guard, asked } = scripted(() => ({ kind: 'allow' }));
    const kernel = withGuard(guard);
    await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    expect(asked.map((charge) => charge.at)).toEqual([
      'turn',
      'fan-out',
      'task-open',
      'task-open',
      'task-open',
    ]);
    expect(new Set(asked.map((charge) => charge.accountId))).toEqual(new Set(['acc-1']));
  });

  it('does not run a turn the guard denies: the task stops and says why', async () => {
    const { guard } = scripted(() => ({ kind: 'deny', reason: 'over the cap' }));
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    expect(tasks.map((task) => task.status)).toEqual(['stopped']);
    expect(steps.map((step) => step.text)).toEqual(['Not run: over the cap.']);
  });

  it('puts a task the guard escalates in waiting, and a stop still ends it', async () => {
    const { guard } = scripted(() => ({ kind: 'escalate', approvalId: 'a-1' }));
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect((await kernel.snapshot(session.id, owner)).tasks[0]?.status).toBe('waiting');
    await kernel.stop(session.id, owner);
    expect((await kernel.snapshot(session.id, owner)).tasks[0]?.status).toBe('stopped');
  });

  it('resumes a turn after its approval: same attempt id, once, and only for the owner', async () => {
    const { guard, asked } = scripted(() =>
      asked.length === 1 ? { kind: 'escalate', approvalId: 'a-1' } : { kind: 'allow' },
    );
    const trace = new MemoryTrace();
    const kernel = new Kernel(trace, new Broker(), oneStep, { budget: guard });
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    const root = (await kernel.snapshot(session.id, owner)).tasks[0]!;
    expect(await trace.task(root.id)).toMatchObject({
      status: 'waiting',
      pending: { attemptId: asked[0]!.attemptId, approvalId: 'a-1', at: 'turn', input: 'q' },
    });

    await expect(
      kernel.requestResume({ accountId: stranger.accountId, approvalId: 'a-1' }),
    ).rejects.toBeInstanceOf(HttpError);
    await expect(
      kernel.requestResume({ accountId: owner.accountId, approvalId: 'a-9' }),
    ).rejects.toBeInstanceOf(HttpError);

    await kernel.requestResume({ accountId: owner.accountId, approvalId: 'a-1' });
    await kernel.idle();
    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    expect(tasks[0]).toMatchObject({ status: 'ended' });
    expect(await trace.task(root.id)).not.toHaveProperty('pending');
    // The page saw why it waited, then the answer.
    expect(steps.map((step) => step.text)).toEqual([
      'Not run: it is over the cap and needs your approval.',
      'got "q"',
    ]);
    expect(asked.map((charge) => charge.attemptId)).toEqual([
      asked[0]!.attemptId,
      asked[0]!.attemptId,
    ]);

    // The approval was consumed by the resume: a second call names nothing.
    await expect(
      kernel.requestResume({ accountId: owner.accountId, approvalId: 'a-1' }),
    ).rejects.toBeInstanceOf(HttpError);
    expect((await kernel.snapshot(session.id, owner)).steps).toHaveLength(2);
  });

  it('keeps a fan-out the guard escalated whole, and runs it after the approval', async () => {
    const { guard, asked } = scripted((charge) =>
      charge.at === 'fan-out' && asked.length === 2
        ? { kind: 'escalate', approvalId: 'a-2' }
        : { kind: 'allow' },
    );
    const trace = new MemoryTrace();
    const kernel = new Kernel(trace, new Broker(), demoWorker(), { budget: guard });
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();

    const before = await kernel.snapshot(session.id, owner);
    expect(before.tasks.map((task) => task.status)).toEqual(['waiting']);
    const pending = (await trace.task(before.tasks[0]!.id))?.pending;
    expect(pending?.at).toBe('fan-out');
    expect(pending?.work).toHaveLength(3);
    const fanOutAttempt = asked[1]!.attemptId;

    await kernel.requestResume({ accountId: owner.accountId, approvalId: 'a-2' });
    await kernel.idle();
    const after = await kernel.snapshot(session.id, owner);
    expect(after.tasks.map((task) => task.status)).toEqual(['ended', 'ended', 'ended', 'ended']);
    expect(await trace.task(after.tasks[0]!.id)).not.toHaveProperty('pending');
    // The fan-out check and every child's task-open check carry the fan-out's attempt id.
    expect(asked.slice(1).map((charge) => [charge.at, charge.attemptId])).toEqual([
      ['fan-out', fanOutAttempt],
      ['fan-out', fanOutAttempt],
      ['task-open', fanOutAttempt],
      ['task-open', fanOutAttempt],
      ['task-open', fanOutAttempt],
    ]);
  });

  it("gives the children of a fan-out the fan-out's attempt id, and each turn its own", async () => {
    const { guard, asked } = scripted(() => ({ kind: 'allow' }));
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'fusion');
    await kernel.idle();
    const [turn, fanOut, ...children] = asked;
    expect(children.map((charge) => charge.attemptId)).toEqual(
      children.map(() => fanOut!.attemptId),
    );
    expect(turn!.attemptId).not.toBe(fanOut!.attemptId);

    await kernel.say(session.id, owner, 'more');
    await kernel.idle();
    const turns = asked.filter((charge) => charge.at === 'turn').map((charge) => charge.attemptId);
    expect(new Set(turns).size).toBe(2);
  });

  it('leaves a waiting task waiting across a restart', async () => {
    const { guard } = scripted(() => ({ kind: 'escalate', approvalId: 'a-3' }));
    const trace = new MemoryTrace();
    const before = new Kernel(trace, new Broker(), oneStep, { budget: guard });
    const { session } = await before.start('p1', owner.accountId, 'q');
    await before.idle();
    const after = new Kernel(trace, new Broker(), oneStep, { budget: guard });
    expect(await after.restore()).toBe(0);
    const root = (await after.snapshot(session.id, owner)).tasks[0]!;
    expect(await trace.task(root.id)).toMatchObject({
      status: 'waiting',
      pending: { approvalId: 'a-3' },
    });
  });

  it('refuses a fan-out the guard denies and opens no child; the parent hears it as an error', async () => {
    const { guard } = scripted((charge) =>
      charge.at === 'fan-out' ? { kind: 'deny', reason: 'over the cap' } : { kind: 'allow' },
    );
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks } = await kernel.snapshot(session.id, owner);
    // demoWorker does not catch the refusal, so its task fails. No reader exists.
    expect(tasks.map((task) => [task.agent, task.status])).toEqual([['lead', 'failed']]);
  });

  it('stops one delegated task the guard denies and lets its siblings run', async () => {
    let opened = 0;
    const { guard } = scripted((charge) => {
      if (charge.at !== 'task-open') return { kind: 'allow' };
      opened += 1;
      return opened === 2 ? { kind: 'deny', reason: 'over the cap' } : { kind: 'allow' };
    });
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const statuses = (await kernel.snapshot(session.id, owner)).tasks.map((task) => task.status);
    expect(statuses.filter((status) => status === 'stopped')).toHaveLength(1);
    expect(statuses.filter((status) => status === 'ended')).toHaveLength(3);
  });

  it('treats a guard that throws as a refusal, never as permission', async () => {
    const { guard } = scripted(() => new Error('billing database is down'));
    const kernel = withGuard(guard);
    const { session } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    const { tasks, steps } = await kernel.snapshot(session.id, owner);
    expect(tasks[0]?.status).toBe('stopped');
    expect(steps[0]?.text).toBe('Not run: the budget could not be checked.');
  });
});

describe('session: the conversation a follow-up turn is given', () => {
  it('keeps the opening question and drops the oldest lines when it is long', () => {
    const long = 'x'.repeat(10_000);
    const input = withConversation(
      [
        { who: 'user', text: 'the question' },
        { who: 'lumen', text: `old ${long}` },
        { who: 'user', text: `middle ${long}` },
        { who: 'lumen', text: `newest ${long}` },
      ],
      'next',
    );
    expect(input).toContain('User: the question');
    expect(input).toContain('You: newest');
    expect(input).not.toContain('You: old');
    expect(input.endsWith('The user now says: next')).toBe(true);
  });
});
