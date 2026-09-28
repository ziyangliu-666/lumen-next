import { describe, expect, it } from 'vitest';
import type { Principal } from '../../core/http/authGuard.js';
import { Broker } from '../../core/protocol/broker.js';
import { steeringCommands } from './commands.js';
import { SteerRegistry } from './steerRegistry.js';

const OWNER: Principal = { accountId: 'acc-owner', role: 'user' };
const OTHER: Principal = { accountId: 'acc-other', role: 'user' };
const STAFF: Principal = { accountId: 'acc-staff', role: 'staff' };

function wire(
  registry: SteerRegistry,
  sessionOf: Record<string, string>,
  ownerOf: Record<string, string>,
): Broker {
  const broker = new Broker();
  steeringCommands({
    registry,
    taskSession: (taskId) => Promise.resolve(sessionOf[taskId] ?? null),
    sessionContext: (sessionId) => {
      const accountId = ownerOf[sessionId];
      return Promise.resolve(accountId ? { projectId: 'p1', accountId } : null);
    },
  })(broker);
  return broker;
}

describe('steeringCommands: task.steer', () => {
  it("queues a steer for the task's owner", async () => {
    const registry = new SteerRegistry();
    const queue = registry.begin('task-1', () => undefined);
    const broker = wire(registry, { 'task-1': 'session-1' }, { 'session-1': OWNER.accountId });

    await broker.dispatch(
      { type: 'task.steer', taskId: 'task-1', text: 'go faster', when: 'next-step' },
      OWNER,
    );

    expect(queue.size).toBe(1);
  });

  it('refuses a task belonging to another account', async () => {
    const registry = new SteerRegistry();
    registry.begin('task-1', () => undefined);
    const broker = wire(registry, { 'task-1': 'session-1' }, { 'session-1': OWNER.accountId });

    await expect(
      broker.dispatch(
        { type: 'task.steer', taskId: 'task-1', text: 'hijack', when: 'next-step' },
        OTHER,
      ),
    ).rejects.toThrow();
  });

  it("refuses an unknown task the same way it refuses someone else's", async () => {
    const registry = new SteerRegistry();
    const broker = wire(registry, {}, {});

    await expect(
      broker.dispatch({ type: 'task.steer', taskId: 'ghost', text: 'x', when: 'next-step' }, OWNER),
    ).rejects.toThrow(/no such task/);
  });

  it('lets staff steer a task that is not theirs', async () => {
    const registry = new SteerRegistry();
    const queue = registry.begin('task-1', () => undefined);
    const broker = wire(registry, { 'task-1': 'session-1' }, { 'session-1': OWNER.accountId });

    await broker.dispatch(
      { type: 'task.steer', taskId: 'task-1', text: 'staff override', when: 'end-of-turn' },
      STAFF,
    );

    expect(queue.size).toBe(1);
  });

  it('does not throw when the task is owned but not currently running', async () => {
    const registry = new SteerRegistry(); // never begin()'d for task-1
    const broker = wire(registry, { 'task-1': 'session-1' }, { 'session-1': OWNER.accountId });

    await expect(
      broker.dispatch(
        { type: 'task.steer', taskId: 'task-1', text: 'too early or too late', when: 'next-step' },
        OWNER,
      ),
    ).resolves.toBe(true);
  });
});
