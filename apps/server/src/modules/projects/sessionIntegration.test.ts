import { describe, expect, it, vi } from 'vitest';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { ProjectService } from './projectService.js';
import { MemoryProjectStore } from './memoryProjectStore.js';

describe('UC2 with the real session public directory', () => {
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
