import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@lumen/contracts';
import type { Worker } from '../../core/domain/worker.js';
import type { Principal } from '../../core/http/authGuard.js';
import { HttpError } from '../../core/http/httpError.js';
import { Broker } from '../../core/protocol/broker.js';
import { echoWorker } from './echoWorker.js';
import { Kernel } from './kernel.js';
import { Trace } from './trace.js';

const owner: Principal = { accountId: 'acc-1', role: 'user' };
const stranger: Principal = { accountId: 'acc-2', role: 'user' };
const staff: Principal = { accountId: 'acc-3', role: 'staff' };

function harness(worker: Worker = echoWorker): { kernel: Kernel; broker: Broker } {
  const broker = new Broker();
  return { kernel: new Kernel(new Trace(), broker, worker), broker };
}

describe('session: kernel', () => {
  it('opens a session with its root task and returns it before the worker runs', () => {
    const { kernel } = harness();
    const snapshot = kernel.start('p1', owner.accountId, 'what is new in fusion?');

    expect(snapshot.session.projectId).toBe('p1');
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]).toMatchObject({
      parentId: null,
      depth: 0,
      agent: 'lead',
      title: 'what is new in fusion?',
    });
  });

  it('runs the worker on the root, records its step, and ends the task', async () => {
    const { kernel } = harness();
    const { session } = kernel.start('p1', owner.accountId, 'question');
    await kernel.idle();

    const snapshot = kernel.snapshot(session.id, owner);
    expect(snapshot.tasks[0]?.status).toBe('ended');
    expect(snapshot.tasks[0]?.endedAt).not.toBeNull();
    expect(snapshot.steps).toHaveLength(1);
    expect(snapshot.steps[0]?.text).toContain('question');
  });

  it('publishes every change to the session, in the order it happened', async () => {
    const { kernel, broker } = harness();
    const seen: string[] = [];
    // Subscribe before start: the session id is not known until then, so
    // listen for whatever id the first event names.
    const original = broker.publish.bind(broker);
    broker.publish = (sessionId: string, event: ServerEvent): void => {
      seen.push(event.type);
      original(sessionId, event);
    };

    kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect(seen).toEqual(['task.opened', 'task.status', 'step.appended', 'task.status']);
  });

  it('marks the task failed when the worker throws, and does not throw itself', async () => {
    const broken: Worker = { run: () => Promise.reject(new Error('no model')) };
    const { kernel } = harness(broken);
    const { session } = kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();

    expect(kernel.snapshot(session.id, owner).tasks[0]?.status).toBe('failed');
  });

  it('turns a say into a step on the root and another worker run', async () => {
    const { kernel } = harness();
    const { session } = kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    await kernel.say(session.id, owner, 'go deeper');
    await kernel.idle();

    const texts = kernel.snapshot(session.id, owner).steps.map((step) => step.text);
    expect(texts[1]).toBe('you: go deeper');
    expect(texts).toHaveLength(3);
  });

  it('stops a running root and lets the verdict stand when the worker finishes', async () => {
    let release: () => void = () => {};
    const slow: Worker = { run: () => new Promise<void>((done) => (release = done)) };
    const { kernel } = harness(slow);
    const { session } = kernel.start('p1', owner.accountId, 'q');

    kernel.stop(session.id, owner);
    release();
    await kernel.idle();

    expect(kernel.snapshot(session.id, owner).tasks[0]?.status).toBe('stopped');
  });

  it('answers a stranger with 404, the same as for a session that does not exist', async () => {
    const { kernel } = harness();
    const { session } = kernel.start('p1', owner.accountId, 'q');

    expect(() => kernel.snapshot(session.id, stranger)).toThrow(HttpError);
    expect(() => kernel.snapshot('nope', owner)).toThrow(HttpError);
    await expect(kernel.say(session.id, stranger, 'hi')).rejects.toMatchObject({ status: 404 });
    expect(await kernel.access.canWatch(stranger, session.id)).toBe(false);
    expect(await kernel.access.canWatch(owner, 'nope')).toBe(false);
  });

  it('lets the owner and staff watch, and nobody else', async () => {
    const { kernel } = harness();
    const { session } = kernel.start('p1', owner.accountId, 'q');

    expect(await kernel.access.canWatch(owner, session.id)).toBe(true);
    expect(await kernel.access.canWatch(staff, session.id)).toBe(true);
    expect(kernel.snapshot(session.id, staff).session.accountId).toBe('acc-1');
  });
});
