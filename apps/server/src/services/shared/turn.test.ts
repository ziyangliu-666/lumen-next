// The turn protocol end to end, without a network or a broker: QueueWorker
// publishes a turn, a "worker" runs it with a RemoteReport whose calls reach
// turnRoutes through Fastify's inject, and the kernel's report sees exactly
// the calls the worker made. This is the join the platform depends on.
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Finding, Task } from '@lumen/contracts';
import { WaitingForApproval, type WorkerReport } from '../../core/domain/worker.js';
import { nullLog } from '../../core/log/log.js';
import { INTERNAL_HEADER, internalCaller, type InternalCall } from './internal.js';
import { QueueWorker } from './queueWorker.js';
import { turnQueue, type TurnMessage } from './rabbit.js';
import { RemoteReport } from './remoteReport.js';
import { registerTurnRoutes } from './turnRoutes.js';

const KEY = 'k'.repeat(40);

const task: Task = {
  id: 'task-1',
  sessionId: 'session-1',
  parentId: null,
  agent: 'lead',
  title: 'root',
  depth: 0,
  status: 'running',
  ownCost: { dollars: 0 },
  startedAt: 0,
  endedAt: null,
};

/** The kernel's side: records every call, and can be told to escalate. */
function recordingReport(options: { escalate?: boolean } = {}): {
  report: WorkerReport;
  calls: string[];
} {
  const calls: string[] = [];
  const report: WorkerReport = {
    log: nullLog,
    appendStep: (taskId, kind, text) => {
      calls.push(`step ${taskId} ${kind} ${text}`);
      return Promise.resolve();
    },
    delegate: (taskId, work) => {
      if (options.escalate) return Promise.reject(new WaitingForApproval('over the cap'));
      calls.push(`delegate ${taskId} ${work.map((item) => item.title).join(',')}`);
      return Promise.resolve(
        work.map((item, index) => ({ ...task, id: `child-${index}`, title: item.title, depth: 1 })),
      );
    },
    recordFinding: (taskId, text, title) => {
      calls.push(`finding ${taskId} ${text} ${title ?? '-'}`);
      return Promise.resolve({ id: 'f1', sessionId: 'session-1', taskId, text } as Finding);
    },
    addSpend: (taskId, amount, reason) => {
      calls.push(`spend ${taskId} ${amount.dollars} ${reason}`);
      return Promise.resolve();
    },
    stopped: () => Promise.resolve(false),
  };
  return { report, calls };
}

/** An InternalCall that reaches the Fastify app in memory. */
function injectCaller(app: FastifyInstance, key = KEY): InternalCall {
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const response = await app.inject({
      method: 'POST',
      url: new URL(url).pathname,
      headers: init.headers as Record<string, string>,
      payload: init.body as string,
    });
    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
    });
  }) as typeof fetch;
  return internalCaller('http://session:4000', key, fetchImpl);
}

describe('the turn protocol', () => {
  let app: FastifyInstance;
  afterEach(() => app.close());

  async function setUp(): Promise<{ turns: QueueWorker; published: TurnMessage[] }> {
    const published: TurnMessage[] = [];
    let next = 0;
    const turns = new QueueWorker(
      (turn) => {
        published.push(turn);
        return Promise.resolve();
      },
      () => `turn-${next++}`,
    );
    app = Fastify();
    registerTurnRoutes(app, turns, KEY);
    await app.ready();
    return { turns, published };
  }

  it('carries every report call from the worker to the kernel, then ends the turn', async () => {
    const { turns, published } = await setUp();
    const { report, calls } = recordingReport();
    const running = turns.run(task, 'the question', report);
    expect(published).toEqual([{ turnId: 'turn-0', task, input: 'the question' }]);

    const call = injectCaller(app);
    const remote = new RemoteReport(call, 'turn-0', nullLog);
    await remote.appendStep('task-1', 'thinking', 'planning');
    const children = await remote.delegate('task-1', [
      { agent: 'reader', title: 'a' },
      { agent: 'reader', title: 'b' },
    ]);
    const finding = await remote.recordFinding('task-1', 'the answer', 'title');
    await remote.addSpend('task-1', { dollars: 0.5 }, 'model');
    expect(await remote.stopped('task-1')).toBe(false);
    await call('/internal/turns/turn-0/done', { ok: true });
    await running;

    expect(children.map((child) => child.id)).toEqual(['child-0', 'child-1']);
    expect(finding.id).toBe('f1');
    expect(calls).toEqual([
      'step task-1 thinking planning',
      'delegate task-1 a,b',
      'finding task-1 the answer title',
      'spend task-1 0.5 model',
    ]);
    expect(turns.inFlight).toBe(0);
  });

  it('brings WaitingForApproval back as the same class on both sides', async () => {
    const { turns } = await setUp();
    const { report } = recordingReport({ escalate: true });
    const running = turns.run(task, 'q', report);
    const call = injectCaller(app);
    const remote = new RemoteReport(call, 'turn-0', nullLog);

    await expect(
      remote.delegate('task-1', [{ agent: 'reader', title: 'a' }]),
    ).rejects.toBeInstanceOf(WaitingForApproval);
    await call('/internal/turns/turn-0/done', { ok: false, error: 'over the cap', waiting: true });
    await expect(running).rejects.toBeInstanceOf(WaitingForApproval);
  });

  it('fails the turn when the worker says so', async () => {
    const { turns } = await setUp();
    const running = turns.run(task, 'q', recordingReport().report);
    await injectCaller(app)('/internal/turns/turn-0/done', { ok: false, error: 'model down' });
    await expect(running).rejects.toThrow('model down');
  });

  it('answers 404 for a turn session does not know, so the worker can drop it', async () => {
    await setUp();
    await expect(
      injectCaller(app)('/internal/turns/nope/done', { ok: true }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses a call without the internal key', async () => {
    await setUp();
    const response = await app.inject({
      method: 'POST',
      url: '/internal/turns/turn-0/done',
      headers: { [INTERNAL_HEADER]: 'wrong' },
      payload: { ok: true },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects the run when the turn cannot be published', async () => {
    const turns = new QueueWorker(() => Promise.reject(new Error('broker down')));
    await expect(turns.run(task, 'q', recordingReport().report)).rejects.toThrow('broker down');
    expect(turns.inFlight).toBe(0);
    app = Fastify();
  });
});

describe('turnQueue', () => {
  it('gives each depth its own queue and shares the last one past the deepest', () => {
    expect([0, 1, 2, 3, 7].map(turnQueue)).toEqual([
      'lumen.turns.0',
      'lumen.turns.1',
      'lumen.turns.2',
      'lumen.turns.2',
      'lumen.turns.2',
    ]);
  });
});
