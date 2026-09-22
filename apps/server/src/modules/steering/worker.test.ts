import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@lumen/contracts';
import type { WorkerReport } from '../../core/domain/worker.js';
import { SandboxFs } from './sandboxFs.js';
import { SteerRegistry } from './steerRegistry.js';
import { createWorker } from './worker.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

function taskOf(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    sessionId: SESSION,
    parentId: null,
    agent: 'lead',
    title: 'find out what changed',
    depth: 0,
    status: 'running',
    ownCost: { dollars: 0 },
    startedAt: Date.now(),
    endedAt: null,
    ...overrides,
  };
}

// Typed as a record of mocks, not as WorkerReport: a variable typed with the
// interface makes every read of one of its methods an "unbound method" as far
// as eslint's rule is concerned. Cast only where something asks for the real
// interface (worker.run).
interface FakeReport {
  readonly appendStep: ReturnType<typeof vi.fn>;
  readonly delegate: ReturnType<typeof vi.fn>;
  readonly recordFinding: ReturnType<typeof vi.fn>;
  readonly addSpend: ReturnType<typeof vi.fn>;
}

function fakeReport(childStatus: Task['status'] = 'ended'): FakeReport {
  return {
    appendStep: vi.fn().mockResolvedValue(undefined),
    delegate: vi
      .fn()
      .mockImplementation((taskId: string, work: readonly { agent: string; title: string }[]) =>
        Promise.resolve(
          work.map((item, index) =>
            taskOf({
              id: `child-${index}`,
              parentId: taskId,
              agent: item.agent,
              title: item.title,
              status: childStatus,
            }),
          ),
        ),
      ),
    recordFinding: vi.fn().mockResolvedValue({
      id: 'finding-1',
      sessionId: SESSION,
      taskId: 'task-1',
      text: '',
      createdAt: Date.now(),
    }),
    addSpend: vi.fn().mockResolvedValue(undefined),
  };
}

function asReport(report: FakeReport): WorkerReport {
  return report as unknown as WorkerReport;
}

let volumeRoot: string;

beforeEach(async () => {
  volumeRoot = await mkdtemp(join(tmpdir(), 'lumen-worker-'));
});

afterEach(async () => {
  await rm(volumeRoot, { recursive: true, force: true });
});

describe('createWorker: the lead', () => {
  it('delegates one reader and replies with how many finished', async () => {
    const registry = new SteerRegistry();
    const context = vi.fn().mockResolvedValue({ projectId: PROJECT, accountId: 'acc-1' });
    const worker = createWorker({ volumeRoot, context, registry });
    const report = fakeReport();

    await worker.run(taskOf({ agent: 'lead' }), 'what changed?', asReport(report));

    expect(report.delegate).toHaveBeenCalledWith(
      'task-1',
      expect.arrayContaining([expect.objectContaining({ agent: 'reader' })]),
    );
    expect(report.appendStep).toHaveBeenCalledWith(
      'task-1',
      'reply',
      expect.stringContaining('1 of 1'),
    );
    // The lead never touches a project: it only plans and delegates.
    expect(context).not.toHaveBeenCalled();
  });

  it('flushes and drops the steer queue even when delegate rejects', async () => {
    const registry = new SteerRegistry();
    const worker = createWorker({ volumeRoot, context: vi.fn(), registry });
    const report = fakeReport();
    report.delegate.mockRejectedValue(new Error('boom'));

    await expect(worker.run(taskOf({ agent: 'lead' }), 'x', asReport(report))).rejects.toThrow(
      'boom',
    );
    expect(() => registry.steer('task-1', 'late', 'next-step')).toThrow();
  });
});

describe('createWorker: a reader', () => {
  it('runs a command, writes its output, records a finding, and replies', async () => {
    const registry = new SteerRegistry();
    const context = vi.fn().mockResolvedValue({ projectId: PROJECT, accountId: 'acc-1' });
    const worker = createWorker({ volumeRoot, context, registry });
    const report = fakeReport();

    await worker.run(taskOf({ agent: 'reader', id: 'reader-1' }), 'a diagnostic', asReport(report));

    expect(context).toHaveBeenCalledWith(SESSION);
    expect(report.appendStep).toHaveBeenCalledWith(
      'reader-1',
      'tool',
      expect.stringContaining('run:'),
      expect.objectContaining({ tool: 'run' }),
    );
    expect(report.recordFinding).toHaveBeenCalledWith('reader-1', expect.any(String));
    expect(report.appendStep).toHaveBeenCalledWith(
      'reader-1',
      'reply',
      expect.stringContaining('Done'),
    );

    // The output really landed on the volume, through SandboxFs, not just in
    // the mock. Default provider is 'none' (no Docker required to develop
    // against this worker), so what landed is NullCompute's own readable
    // failure — the point is that it came from a real Compute.run() and a
    // real SandboxFs.writeFile(), not that this environment has Docker.
    const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
    const log = await sandbox.readFile('/mnt/workspace/reader-1.log');
    expect(log.toString()).toContain('no compute provider is configured');
  });

  it('replies and does nothing else when the session has no project', async () => {
    const registry = new SteerRegistry();
    const context = vi.fn().mockResolvedValue(null);
    const worker = createWorker({ volumeRoot, context, registry });
    const report = fakeReport();

    await worker.run(taskOf({ agent: 'reader', id: 'reader-1' }), 'x', asReport(report));

    expect(report.appendStep).toHaveBeenCalledWith(
      'reader-1',
      'reply',
      expect.stringContaining('No project'),
    );
    expect(report.recordFinding).not.toHaveBeenCalled();
  });

  it('lands a steer queued mid-run as a "you" step', async () => {
    const registry = new SteerRegistry();
    const context = vi.fn().mockResolvedValue({ projectId: PROJECT, accountId: 'acc-1' });
    const worker = createWorker({ volumeRoot, context, registry });
    const report = fakeReport();

    // Land it the moment the tool step is written — the same "somebody else
    // queued this while the run was in flight" shape task.steer's handler
    // produces, just called directly since this test is not going through
    // the broker.
    report.appendStep.mockImplementation((taskId: string, kind: string) => {
      if (kind === 'tool') registry.steer('reader-1', 'hurry up', 'next-step');
      return Promise.resolve();
    });

    await worker.run(taskOf({ agent: 'reader', id: 'reader-1' }), 'x', asReport(report));

    expect(report.appendStep).toHaveBeenCalledWith('reader-1', 'you', 'hurry up');
  });
});
