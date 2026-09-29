import { describe, expect, it, vi } from 'vitest';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { ProjectService } from './projectService.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { createSteeringSlice } from '../steering/index.js';
import type { Completion, ModelProvider } from '../../core/model/index.js';
import { tmpdir } from 'node:os';

describe('UC2 with the real session public directory', () => {
  it('shows real steering worker results after a queued steer reaches the model', async () => {
    const broker = new Broker();
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = (): void => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let calls = 0;
    let heardSteer = false;
    const completion = (text: string, toolCalls: Completion['toolCalls'] = []): Completion => ({
      text,
      toolCalls,
      stopReason: toolCalls.length ? 'tool' : 'end',
      usage: { inputTokens: 1, outputTokens: 1 },
      cost: { dollars: 0.01 },
      model: 'acceptance',
      durationMs: 1,
    });
    const model: ModelProvider = {
      name: 'acceptance',
      model: 'acceptance',
      async complete(request) {
        calls += 1;
        if (calls === 1) {
          entered();
          await gate;
          return completion('Initial answer');
        }
        heardSteer ||= request.messages.some((message) => message.content === 'Review the result');
        if (calls === 2)
          return completion('', [
            {
              id: 'delegate-1',
              name: 'delegate',
              arguments: { tasks: ['Review'] },
            },
          ]);
        if (calls === 3)
          return completion('', [
            { id: 'finding-1', name: 'record_finding', arguments: { text: 'Steered finding' } },
          ]);
        return completion('Reviewed');
      },
    };
    const steering = createSteeringSlice({
      volumeRoot: tmpdir(),
      model,
      taskSession: (id) => session.projects.taskSession(id),
      sessionContext: (id) => session.projects.context(id),
    });
    const session = createSessionSlice({
      broker,
      worker: steering.worker,
      requireProject: (principal, id) => service.requireProject(principal, id),
      recordFinding: (sessionId, taskId, text) => service.recordFinding(sessionId, taskId, text),
    });
    const service: ProjectService = new ProjectService(new MemoryProjectStore(), session.projects);
    steering.registerCommands(broker);
    const owner = { accountId: 'steering-owner', role: 'user' as const };
    try {
      const created = await service.create(owner, { question: 'Review', mode: 'explore' });
      await started;
      const snapshot = await session.kernel.snapshot(created.sessionId, owner);
      await broker.dispatch(
        {
          type: 'task.steer',
          taskId: snapshot.tasks[0]!.id,
          text: 'Review the result',
          when: 'next-step',
        },
        owner,
      );
      release();
      await session.kernel.idle();
      expect(heardSteer).toBe(true);
      expect(calls).toBe(5);
      const card = await service.get(owner, created.project.id);
      expect(card).toMatchObject({ label: 'Finished', findingsCount: 1 });
      expect(card.latestSession?.spend.dollars).toBeCloseTo(0.05, 6);
      expect((await service.findings(owner, created.project.id, {})).items[0]?.text).toBe(
        'Steered finding',
      );
    } finally {
      release();
      await session.kernel.idle();
    }
  });

  it('creates, observes execution, records findings, and stops only the latest run', async () => {
    let release = (): void => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const session = createSessionSlice({
      broker: new Broker(),
      worker: { run: () => waiting },
      requireProject: (principal, id) => service.requireProject(principal, id),
      recordFinding: (sessionId, taskId, text) => service.recordFinding(sessionId, taskId, text),
    });
    const service: ProjectService = new ProjectService(new MemoryProjectStore(), session.projects);
    const owner = { accountId: 'alice', role: 'user' as const };
    try {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const first = await service.create(owner, { question: 'First question', mode: 'explore' });
      vi.mocked(Date.now).mockReturnValue(now + 1);
      const latest = await session.projects.start(
        first.project.id,
        owner,
        'Second question',
        'seed',
      );
      const snapshot = await session.kernel.snapshot(latest.id, owner);
      expect(snapshot.session.mode).toBe('seed');
      const finding = await service.recordFinding(
        latest.id,
        snapshot.tasks[0]!.id,
        'A durable result',
      );
      expect((await service.get(owner, first.project.id)).latestSession?.id).toBe(latest.id);
      await service.stop(owner, first.project.id);
      expect((await session.kernel.snapshot(first.sessionId, owner)).tasks[0]?.status).toBe(
        'running',
      );
      expect((await service.get(owner, first.project.id)).latestSession?.status).toBe('stopped');
      expect((await service.findings(owner, first.project.id, {})).items).toEqual([finding]);
      await expect(
        service.requireProject({ accountId: 'bob', role: 'user' }, first.project.id),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      vi.restoreAllMocks();
      release();
      await session.kernel.idle();
    }
  });
});
