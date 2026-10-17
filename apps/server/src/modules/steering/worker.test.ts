import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@lumen/contracts';
import type { WorkerReport } from '../../core/domain/worker.js';
import { nullLog, type Log } from '../../core/log/log.js';
import { capture } from '../../core/log/testLog.js';
import {
  ModelError,
  type Completion,
  type ModelProvider,
  type ModelRequest,
  type ToolCall,
} from '../../core/model/index.js';
import { SandboxFs } from './sandboxFs.js';
import { SteerRegistry } from './steerRegistry.js';
import { createWorker, inSandboxTerms, isBinary } from './worker.js';

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
  readonly log: Log;
  readonly appendStep: ReturnType<typeof vi.fn>;
  readonly delegate: ReturnType<typeof vi.fn>;
  readonly recordFinding: ReturnType<typeof vi.fn>;
  readonly addSpend: ReturnType<typeof vi.fn>;
}

function fakeReport(log: Log = nullLog): FakeReport {
  return {
    log,
    appendStep: vi.fn().mockResolvedValue(undefined),
    delegate: vi.fn().mockResolvedValue([]),
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

/** The steps a report received, as [kind, text] pairs, in order. */
function stepsOf(report: FakeReport): [string, string][] {
  return report.appendStep.mock.calls.map((call) => [String(call[1]), String(call[2])]);
}

type Answer = Partial<Completion> | ((request: ModelRequest) => Partial<Completion>);

/**
 * A model that gives the answers it was scripted with, one per call, and
 * keeps a copy of every request it saw. Running out of script is a test bug,
 * so it says so rather than inventing an answer.
 */
function scripted(...answers: Answer[]): ModelProvider & { readonly requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    name: 'scripted',
    model: 'scripted-1',
    requests,
    complete(request) {
      // The worker keeps adding to its conversation; keep what this call saw.
      requests.push({ ...request, messages: [...request.messages] });
      const next = answers.shift();
      if (!next) return Promise.reject(new Error('the script ran out'));
      const answer = typeof next === 'function' ? next(request) : next;
      return Promise.resolve({
        text: '',
        toolCalls: [],
        stopReason: answer.toolCalls?.length ? 'tool' : 'end',
        usage: { inputTokens: 10, outputTokens: 5 },
        cost: { dollars: 0.001 },
        model: 'scripted-1',
        durationMs: 3,
        ...answer,
      });
    },
  };
}

function toolCall(name: string, args: Record<string, unknown>, id = `call-${name}`): ToolCall {
  return { id, name, arguments: args };
}

let volumeRoot: string;
let registry: SteerRegistry;
const context = vi.fn();

beforeEach(async () => {
  volumeRoot = await mkdtemp(join(tmpdir(), 'lumen-worker-'));
  registry = new SteerRegistry();
  context.mockReset().mockResolvedValue({ projectId: PROJECT, accountId: 'acc-1' });
});

afterEach(async () => {
  await rm(volumeRoot, { recursive: true, force: true });
});

describe('createWorker: the conversation', () => {
  it('replies with what the model answered, and puts its receipt on the step', async () => {
    const model = scripted({ text: 'It was the config.' });
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf(),
      'what changed?',
      asReport(report),
    );

    expect(report.appendStep).toHaveBeenCalledWith('task-1', 'reply', 'It was the config.', {
      tool: 'model: scripted-1',
      durationMs: 3,
      cost: { dollars: 0.001 },
    });
    expect(model.requests[0]!.messages).toEqual([{ role: 'user', content: 'what changed?' }]);
  });

  it('with no model given, answers at once through the model that does nothing', async () => {
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry }).run(taskOf(), 'hi', asReport(report));

    expect(stepsOf(report)).toEqual([['reply', expect.stringContaining('No model is configured')]]);
  });

  it('gives a lead only the lead tools, and a reader only the reader tools', async () => {
    const model = scripted({ text: 'a' }, { text: 'b' });
    const worker = createWorker({ volumeRoot, context, registry, model });

    await worker.run(taskOf({ agent: 'lead' }), 'x', asReport(fakeReport()));
    await worker.run(taskOf({ id: 'r', agent: 'reader' }), 'x', asReport(fakeReport()));

    const names = (request: ModelRequest): string[] => (request.tools ?? []).map((t) => t.name);
    expect(names(model.requests[0]!)).toEqual(['search', 'delegate', 'list_files', 'read_file']);
    expect(names(model.requests[1]!)).toEqual([
      'search',
      'run',
      'list_files',
      'read_file',
      'write_file',
      'record_finding',
    ]);
  });

  it('stops after a bounded number of model calls', async () => {
    const loop = (): Partial<Completion> => ({
      toolCalls: [toolCall('list_files', { path: '/mnt/workspace' })],
    });
    const model = scripted(...Array.from({ length: 20 }, () => loop));
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ agent: 'reader' }),
      'x',
      asReport(report),
    );

    expect(model.requests).toHaveLength(12);
    expect(stepsOf(report).at(-1)).toEqual(['reply', expect.stringContaining('Stopped after 12')]);
  });

  it('runs no tool and calls the model no more once the task is stopped, and still charges the call', async () => {
    const model = scripted(
      {
        text: 'Listing first.',
        toolCalls: [toolCall('list_files', { path: '/mnt/workspace' })],
        cost: { dollars: 0.002 },
      },
      { text: 'never asked' },
    );
    const report = fakeReport();
    // The stop lands while the first model call is in flight.
    const stopped = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ agent: 'reader' }),
      'x',
      { ...asReport(report), stopped },
    );

    expect(model.requests).toHaveLength(1);
    expect(stepsOf(report)).toEqual([['thinking', 'Listing first.']]);
    expect(report.appendStep.mock.calls[0]![3]).toMatchObject({ cost: { dollars: 0.002 } });
    expect(context).not.toHaveBeenCalled();
  });

  it('writes why on the trace and fails the task when the model cannot be reached', async () => {
    const model: ModelProvider = {
      name: 'broken',
      model: 'broken-1',
      complete: () => Promise.reject(new ModelError('auth', 'the key was refused', 401)),
    };
    const report = fakeReport();

    await expect(
      createWorker({ volumeRoot, context, registry, model }).run(taskOf(), 'x', asReport(report)),
    ).rejects.toThrow('the key was refused');
    expect(stepsOf(report)).toEqual([
      [
        'reply',
        'Stopped: the model key was refused. If you saved an OpenAI key, replace it in Settings, Keys.',
      ],
    ]);
    expect(() => registry.steer('task-1', 'late', 'next-step')).toThrow();
  });
});

describe('createWorker: tools', () => {
  it('lets a lead delegate, and hands it back what each reader answered', async () => {
    const lead = scripted(
      { toolCalls: [toolCall('delegate', { tasks: ['check the disk', 'check the logs'] })] },
      { text: 'Both are fine.' },
    );
    const reader = scripted({ text: 'disk: 10% used' }, { text: 'logs: quiet' });
    // One worker runs the lead and its readers, as in the app: a reader's
    // answer is kept by the worker that ran it, for its lead to read.
    const model: ModelProvider = {
      name: 'scripted',
      model: 'scripted-1',
      complete: (request) =>
        (request.system.startsWith('You are a reader') ? reader : lead).complete(request),
    };
    const worker = createWorker({ volumeRoot, context, registry, model });
    const report = fakeReport();
    // What the kernel does: open a child per entry, run each through the
    // worker, and resolve with the children as they ended.
    report.delegate.mockImplementation(async (taskId: string, work: { title: string }[]) => {
      const children = work.map((item, index) =>
        taskOf({ id: `child-${index}`, parentId: taskId, agent: 'reader', title: item.title }),
      );
      for (const child of children) await worker.run(child, child.title, asReport(fakeReport()));
      return children.map((child) => ({ ...child, status: 'ended' }));
    });

    await worker.run(taskOf(), 'is everything ok?', asReport(report));

    expect(report.delegate).toHaveBeenCalledWith('task-1', [
      { agent: 'reader', title: 'check the disk' },
      { agent: 'reader', title: 'check the logs' },
    ]);
    const handedBack = lead.requests[1]!.messages.at(-1)!;
    expect(handedBack).toMatchObject({ role: 'tool', toolCallId: 'call-delegate' });
    expect(handedBack.content).toContain('disk: 10% used');
    expect(handedBack.content).toContain('logs: quiet');
    expect(stepsOf(report).at(-1)).toEqual(['reply', 'Both are fine.']);
  });

  it("runs a reader's command through Compute and gives the model its output", async () => {
    const model = scripted(
      { toolCalls: [toolCall('run', { command: 'df -h' })] },
      { text: 'Could not check.' },
    );
    const { log, lines } = capture();
    const report = fakeReport(log);

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ id: 'reader-1', agent: 'reader' }),
      'check the disk',
      asReport(report),
    );

    // Default provider is 'none': what came back is NullCompute's own
    // readable failure, which proves the command went through a real Compute.
    const [, kind, text, detail] = report.appendStep.mock.calls[0] as [
      string,
      string,
      string,
      { tool: string; output: string },
    ];
    expect([kind, text, detail.tool]).toEqual(['tool', 'run: df -h', 'run']);
    expect(detail.output).toContain('no compute');
    const handedBack = model.requests[1]!.messages.at(-1)!;
    expect(handedBack).toMatchObject({ role: 'tool', toolCallId: 'call-run' });
    expect(handedBack.content).toContain('exit 1');
    // Every model call and the command run are on the log, through the task's own log (#42).
    expect(lines().map((line) => line['msg'])).toEqual(['model call', 'compute run', 'model call']);
    expect(lines()[1]).toMatchObject({ tool: 'run', provider: 'none', exitCode: 1 });
  });

  it('writes and reads files through the sandbox, and records findings', async () => {
    const model = scripted(
      {
        toolCalls: [
          toolCall('write_file', { path: '/mnt/output/r.md', content: '# done' }, 'w'),
          toolCall('read_file', { path: '/mnt/output/r.md' }, 'r'),
          toolCall('record_finding', { text: 'the report is written' }, 'f'),
        ],
      },
      { text: 'Written.' },
    );
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ id: 'reader-1', agent: 'reader' }),
      'write it',
      asReport(report),
    );

    const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
    expect((await sandbox.readFile('/mnt/output/r.md')).toString()).toBe('# done');
    expect(report.recordFinding).toHaveBeenCalledWith('reader-1', 'the report is written');
    const results = model.requests[1]!.messages.filter((m) => m.role === 'tool');
    expect(results.map((m) => m.content)).toEqual(['wrote /mnt/output/r.md', '# done', 'recorded']);
  });

  it('tells the model, and does not fail the task, when a tool call is wrong', async () => {
    const model = scripted(
      {
        toolCalls: [
          toolCall('read_file', { path: '/mnt/workspace/../../etc/passwd' }, 'escape'),
          toolCall('read_file', { path: '/mnt/upload' }, 'a-directory'),
          toolCall('read_file', { path: '/mnt/upload/missing.txt' }, 'missing'),
          toolCall('run', {}, 'no-command'),
          toolCall('delegate', { tasks: ['x'] }, 'not-a-reader-tool'),
        ],
      },
      { text: 'Giving up.' },
    );
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ id: 'reader-1', agent: 'reader' }),
      'x',
      asReport(report),
    );

    const results = model.requests[1]!.messages.filter((m) => m.role === 'tool');
    expect(results.map((m) => m.content)).toEqual([
      expect.stringMatching(/^error: /),
      // Said in the agent's own /mnt terms, not as Node's host-path errors.
      'error: /mnt/upload is a folder, not a file',
      'error: no such file or folder: /mnt/upload/missing.txt',
      'error: run needs "command" as a non-empty string',
      'error: there is no tool called delegate',
    ]);
    expect(report.delegate).not.toHaveBeenCalled();
    expect(stepsOf(report).at(-1)).toEqual(['reply', 'Giving up.']);
  });

  it('refuses file tools, in words, for a session that belongs to no project', async () => {
    context.mockResolvedValue(null);
    const model = scripted(
      { toolCalls: [toolCall('list_files', { path: '/mnt/upload' })] },
      { text: 'No files.' },
    );

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ agent: 'reader' }),
      'x',
      asReport(fakeReport()),
    );

    expect(model.requests[1]!.messages.at(-1)!.content).toContain('belongs to no project');
  });

  it('answers a listing of /mnt itself with the three folders', async () => {
    const model = scripted(
      { toolCalls: [toolCall('list_files', { path: '/mnt/' })] },
      { text: 'Seen.' },
    );

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ agent: 'reader' }),
      'x',
      asReport(fakeReport()),
    );

    const listing = model.requests[1]!.messages.at(-1)!.content;
    expect(listing).toMatch(/\/mnt\/upload.*\/mnt\/workspace.*\/mnt\/output/s);
    expect(listing).not.toContain('outside');
  });

  it('does not look up the project for a turn that never touches a file', async () => {
    await createWorker({ volumeRoot, context, registry, model: scripted({ text: 'ok' }) }).run(
      taskOf(),
      'x',
      asReport(fakeReport()),
    );

    expect(context).not.toHaveBeenCalled();
  });
});

describe('createWorker: steering', () => {
  it('lands a steer sent during a tool call before the next model call', async () => {
    const model = scripted(
      { toolCalls: [toolCall('list_files', { path: '/mnt/workspace' })] },
      { text: 'Stopped as asked.' },
    );
    const report = fakeReport();
    report.appendStep.mockImplementation((_taskId: string, kind: string) => {
      if (kind === 'tool') registry.steer('reader-1', 'stop there', 'next-step');
      return Promise.resolve();
    });

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ id: 'reader-1', agent: 'reader' }),
      'x',
      asReport(report),
    );

    expect(stepsOf(report).map(([kind]) => kind)).toEqual(['tool', 'you', 'reply']);
    expect(model.requests[1]!.messages.at(-1)).toEqual({ role: 'user', content: 'stop there' });
  });

  it('does not end a turn while a steer is waiting: the model hears it first', async () => {
    // The model is about to answer when the user speaks. Before this worker,
    // a next-step steer sent at this moment was dropped with the turn.
    const model = scripted(
      () => {
        registry.steer('task-1', 'also check Q3', 'next-step');
        return { text: 'Q2 looks fine.' };
      },
      { text: 'Q2 and Q3 look fine.' },
    );
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf(),
      'check Q2',
      asReport(report),
    );

    expect(stepsOf(report)).toEqual([
      ['thinking', 'Q2 looks fine.'],
      ['you', 'also check Q3'],
      ['reply', 'Q2 and Q3 look fine.'],
    ]);
    expect(model.requests[1]!.messages.slice(-2)).toEqual([
      { role: 'assistant', content: 'Q2 looks fine.' },
      { role: 'user', content: 'also check Q3' },
    ]);
  });

  it('holds an end-of-turn steer until the model would otherwise stop', async () => {
    const model = scripted(
      () => {
        registry.steer('task-1', 'then summarise', 'end-of-turn');
        return { toolCalls: [toolCall('list_files', { path: '/mnt/workspace' })] };
      },
      { text: 'Empty.' },
      { text: 'Summary: empty.' },
    );
    const report = fakeReport();

    await createWorker({ volumeRoot, context, registry, model }).run(
      taskOf({ agent: 'reader' }),
      'x',
      asReport(report),
    );

    // Not before the second call, where a next-step steer would have landed.
    expect(model.requests[1]!.messages.some((m) => m.content === 'then summarise')).toBe(false);
    expect(stepsOf(report).map(([kind]) => kind)).toEqual(['tool', 'thinking', 'you', 'reply']);
  });

  it('refuses a steer once the run is over', async () => {
    await createWorker({ volumeRoot, context, registry, model: scripted({ text: 'ok' }) }).run(
      taskOf(),
      'x',
      asReport(fakeReport()),
    );

    expect(() => registry.steer('task-1', 'late', 'next-step')).toThrow();
  });
});

describe("createWorker: errors in the agent's terms", () => {
  it('names the /mnt path the agent asked for, never the host folder', () => {
    const call = { id: 'c', name: 'read_file', arguments: { path: '/mnt/output/table.txt' } };
    expect(
      inSandboxTerms(
        "ENOENT: no such file or directory, open '/app/.data/p1/output/table.txt'",
        call,
      ),
    ).toBe('no such file or folder: /mnt/output/table.txt');
    expect(inSandboxTerms('quota reached', call)).toBe('quota reached');
  });
});

describe('isBinary', () => {
  it('tells a PDF or a NUL byte from text in any script', () => {
    expect(isBinary(Buffer.from([0x25, 0x50, 0x44, 0x46, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))).toBe(
      true,
    );
    expect(isBinary(Buffer.from('a\u0000b'))).toBe(true);
    expect(isBinary(Buffer.from('n,a(n)\n1,1\n数据,表\n'))).toBe(false);
    // A character cut at the 8 KB mark is still text.
    expect(isBinary(Buffer.from(`${'x'.repeat(8191)}数`).subarray(0, 8193))).toBe(false);
  });
});
