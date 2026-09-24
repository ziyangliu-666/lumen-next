import type { Task } from '@lumen/contracts';
import type { Worker, WorkerReport } from '../../core/domain/worker.js';
import { compute } from './compute.js';
import { SandboxFs } from './sandboxFs.js';
import type { SteerQueue } from './steerCommand.js';
import type { SteerRegistry } from './steerRegistry.js';

// The agent loop behind the Worker interface (docs/ARCHITECTURE.md §6). No
// model yet — the point of this worker is that everything around where a
// model goes is real: a lead really delegates, through the kernel's own
// Delegation bounds; a reader really runs a command, through Compute, in the
// sandbox SandboxFs already validates every path against; a landed steer
// really reaches the trace as a 'you' step, through SteerRegistry. Wiring a
// model in later replaces what a reader decides to run — nothing about how it
// runs, or how any of the above fits together, changes.

const DEFAULT_TIMEOUT_MS = 30_000;

export interface WorkerOptions {
  readonly volumeRoot: string;
  /** From the session slice's own SessionDirectory: which project a session belongs to. */
  readonly context: (
    sessionId: string,
  ) => Promise<{ readonly projectId: string; readonly accountId: string } | null>;
  readonly registry: SteerRegistry;
  /** Which Compute a reader's command runs against. Defaults to 'none': no Docker required to develop against this worker. */
  readonly provider?: 'docker' | 'none';
  readonly timeoutMs?: number;
}

async function runLead(
  task: Task,
  input: string,
  report: WorkerReport,
  queue: SteerQueue,
): Promise<void> {
  await report.appendStep(
    task.id,
    'thinking',
    `No model is wired in yet: delegating one reader to run a diagnostic command for "${input}".`,
  );
  // A steer that landed while the thinking step above was writing is worth
  // giving a chance to reach the trace before the fan-out, not just at the
  // very end of the turn.
  queue.flush('next-step');

  const children = await report.delegate(task.id, [
    { agent: 'reader', title: `diagnostic for: ${input}` },
  ]);
  const ended = children.filter((child) => child.status === 'ended').length;
  await report.appendStep(
    task.id,
    'reply',
    `${ended} of ${children.length} reader(s) finished. No model is wired in, so there is nothing to conclude.`,
  );
}

async function runReader(
  task: Task,
  report: WorkerReport,
  sandbox: SandboxFs,
  provider: 'docker' | 'none',
  timeoutMs: number,
  queue: SteerQueue,
): Promise<void> {
  // Fixed, not derived from the title: there is no model here to decide what
  // a reader should run, and a title built from a user's words is not a shell
  // command this worker gets to trust. What it proves is the pipeline —
  // Compute really runs something, SandboxFs really keeps its output — not
  // that the command is well chosen.
  const command = 'echo "no model is wired in yet"; date';
  const startedAt = Date.now();
  const runner = compute(provider, sandbox.hostMounts);
  const result = await runner.run(command, { cwd: '/mnt/workspace', timeoutMs });
  const durationMs = Date.now() - startedAt;

  await report.appendStep(task.id, 'tool', `run: ${command}`, {
    tool: 'run',
    durationMs,
    output:
      [result.stdout, result.stderr]
        .filter((part) => part.length > 0)
        .join('\n')
        .trim() || '(no output)',
  });
  // Between this step and what follows is the other moment a steer may land.
  queue.flush('next-step');

  const logPath = `/mnt/workspace/${task.id}.log`;
  await sandbox.writeFile(
    logPath,
    Buffer.from(`exit ${result.exitCode}\n${result.stdout}${result.stderr}`),
  );

  await report.recordFinding(
    task.id,
    `Ran a diagnostic command for "${task.title}"; exit code ${result.exitCode}. No model wrote this.`,
  );
  await report.appendStep(task.id, 'reply', `Done. Exit code ${result.exitCode}.`);
}

export function createWorker(options: WorkerOptions): Worker {
  const provider = options.provider ?? 'none';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async run(task, input, report) {
      const queue = options.registry.begin(task.id, report);
      try {
        if (task.agent === 'lead') {
          await runLead(task, input, report, queue);
          return;
        }
        const context = await options.context(task.sessionId);
        if (!context) {
          await report.appendStep(
            task.id,
            'reply',
            'No project found for this session: nothing to run.',
          );
          return;
        }
        const sandbox = new SandboxFs(options.volumeRoot, context.projectId, task.sessionId);
        await sandbox.ensureDirectories();
        await runReader(task, report, sandbox, provider, timeoutMs, queue);
      } finally {
        // Whatever a steer for this task is still waiting for at the end of
        // the turn lands now, even if no step-boundary flush above reached it.
        queue.flush('end-of-turn');
        options.registry.end(task.id);
      }
    },
  };
}
