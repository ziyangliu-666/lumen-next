import { describe, expect, it } from 'vitest';
import type { Session } from '@lumen/contracts';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice } from '../session/index.js';
import { ProjectService } from './projectService.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import type { ProjectSessions } from './ports.js';
import type { ProjectMode } from './models.js';

describe('UC2 with the real session public kernel', () => {
  it('creates, observes execution, records findings, and stops only the latest run', async () => {
    const broker = new Broker();
    let release = (): void => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const session = createSessionSlice({ broker, worker: { run: () => waiting } });
    // Test-owned lookup adapter fills the public lookup seam missing in session today.
    const records: (Session & { mode: ProjectMode })[] = [];
    const tasks = new Map<string, string>();
    const port: ProjectSessions = {
      async start(projectId, principal, question, mode) {
        const snapshot = await session.kernel.start(projectId, principal.accountId, question);
        records.push({ ...snapshot.session, mode });
        for (const task of snapshot.tasks) tasks.set(task.id, task.sessionId);
        return snapshot.session;
      },
      async list(projectId, principal) {
        return Promise.all(
          records
            .filter((s) => s.projectId === projectId && s.accountId === principal.accountId)
            .map(async (s) => {
              const snapshot = await session.kernel.snapshot(s.id, principal);
              const root = snapshot.tasks.find((t) => t.parentId === null)!;
              return {
                id: s.id,
                mode: s.mode,
                startedAt: s.startedAt,
                endedAt: root.endedAt,
                status: root.status,
                spend: snapshot.spend,
              };
            }),
        );
      },
      stop: (id, principal) => session.kernel.stop(id, principal),
      context: (id) => Promise.resolve(records.find((s) => s.id === id) ?? null),
      taskSession: (id) => Promise.resolve(tasks.get(id) ?? null),
    };
    try {
      const service = new ProjectService(new MemoryProjectStore(), port);
      const owner = { accountId: 'alice', role: 'user' as const };
      const created = await service.create(owner, { question: 'First question', mode: 'explore' });
      const latest = await port.start(created.project.id, owner, 'Second question', 'seed');
      const first = records[0]!;
      records[1] = { ...records[1]!, startedAt: first.startedAt + 1 };
      const snapshot = await session.kernel.snapshot(latest.id, owner);
      const finding = await service.recordFinding(
        latest.id,
        snapshot.tasks[0]!.id,
        'A durable result',
      );
      expect((await service.get(owner, created.project.id)).latestSession?.id).toBe(latest.id);
      await service.stop(owner, created.project.id);
      expect((await session.kernel.snapshot(first.id, owner)).tasks[0]?.status).toBe('running');
      expect((await service.get(owner, created.project.id)).latestSession?.status).toBe('stopped');
      expect((await service.findings(owner, created.project.id, {})).items).toEqual([finding]);
    } finally {
      release();
      await session.kernel.idle();
    }
  });
});
