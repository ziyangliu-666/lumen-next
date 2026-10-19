import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Scope } from './sandboxFs.js';

// The sandbox behind its own interface: a
// worker asks Compute to run one command and never learns whether that meant
// a container or nothing at all.

export interface ComputeResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface Compute {
  run(command: string, options: { cwd: string; timeoutMs: number }): Promise<ComputeResult>;
}

/**
 * Null Object: every run answers with a readable failure and never throws, so
 * a worker built against `Compute` needs no branch for "there is no provider" —
 * running with no Docker on the host behaves like running against a compute
 * provider that always declines, not like a missing dependency.
 */
export const NullCompute: Compute = {
  run(): Promise<ComputeResult> {
    return Promise.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'no compute provider is configured: nothing ran',
    });
  },
};

/** No tool a "no model yet" worker runs needs more than this; raise it once one does. */
const DEFAULT_MEMORY = '512m';
/**
 * Pinned, not `:latest`: a worker's output must not change because an image
 * did. Alpine with Python 3: the readers count and check sequences by writing
 * small Python programs, and bare Alpine has no interpreter, so every such
 * run failed with "python3: not found".
 */
const DEFAULT_IMAGE = 'python:3.12-alpine3.20';

export interface DockerComputeOptions {
  readonly image?: string;
  readonly memory?: string;
  /**
   * A folder of Python packages on this host, mounted read-only on the
   * sandbox's import path: how the readers get matplotlib, numpy and sympy
   * without a network to install them (deploy/sandbox). It must be built for
   * the same Python as the image.
   */
  readonly libs?: string;
}

/** Where a sandbox is run from: the image, and the packages mounted into it. */
export type SandboxSetup = Pick<DockerComputeOptions, 'image' | 'libs'>;

/**
 * Runs the command in a container, `SandboxFs.hostMounts` bind-mounted at the
 * same paths the agent already addresses them by, no network, a memory limit
 * and the caller's timeout. `upload` is mounted read-only — the container
 * cannot use a shell to do what `SandboxFs.writeFile` already refuses.
 *
 * The container is named so a timeout can `docker kill` it by name: killing
 * the local `docker run` process alone does not stop a container that is not
 * detached, it only stops streaming its logs. `--rm` then removes it once it
 * has actually stopped, on either path.
 */
/** The uid:gid this process runs as, for the container to run as the same. Absent on Windows. */
function processUser(): string | undefined {
  return typeof process.getuid === 'function' && typeof process.getgid === 'function'
    ? `${process.getuid()}:${process.getgid()}`
    : undefined;
}

/**
 * The `docker run` line, as a list. What the container may not do is here:
 * no network, a memory and a CPU limit, a cap on processes so a fork bomb
 * ends with the container, every capability dropped and none regained, and
 * the process user rather than root, so a file it writes into the workspace
 * is the server's own.
 */
export function dockerArgs(spec: {
  readonly name: string;
  readonly image: string;
  readonly memory: string;
  readonly hostMounts: Readonly<Record<Scope, string>>;
  readonly cwd: string;
  readonly command: string;
  readonly user?: string | undefined;
  readonly libs?: string | undefined;
}): string[] {
  return [
    'run',
    '--rm',
    '--name',
    spec.name,
    '--network',
    'none',
    '--memory',
    spec.memory,
    '--cpus',
    '1',
    '--pids-limit',
    '256',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    ...(spec.user ? ['--user', spec.user] : []),
    '--workdir',
    spec.cwd,
    '-v',
    `${spec.hostMounts.upload}:/mnt/upload:ro`,
    '-v',
    `${spec.hostMounts.workspace}:/mnt/workspace`,
    '-v',
    `${spec.hostMounts.output}:/mnt/output`,
    // The packages, read-only, on the import path; plots are drawn to files
    // (no display), with matplotlib's cache in the container's own /tmp.
    ...(spec.libs
      ? [
          '-v',
          `${spec.libs}:/opt/lumen-lib:ro`,
          '-e',
          'PYTHONPATH=/opt/lumen-lib',
          '-e',
          'MPLBACKEND=Agg',
          '-e',
          'MPLCONFIGDIR=/tmp',
        ]
      : []),
    spec.image,
    'sh',
    '-c',
    spec.command,
  ];
}

export class DockerCompute implements Compute {
  private readonly image: string;
  private readonly memory: string;
  private readonly libs: string | undefined;

  constructor(
    private readonly hostMounts: Readonly<Record<Scope, string>>,
    options: DockerComputeOptions = {},
  ) {
    this.image = options.image ?? DEFAULT_IMAGE;
    this.memory = options.memory ?? DEFAULT_MEMORY;
    this.libs = options.libs;
  }

  run(command: string, options: { cwd: string; timeoutMs: number }): Promise<ComputeResult> {
    const name = `lumen-${randomUUID()}`;
    const args = dockerArgs({
      name,
      image: this.image,
      memory: this.memory,
      hostMounts: this.hostMounts,
      cwd: options.cwd,
      command,
      user: processUser(),
      libs: this.libs,
    });

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const child = spawn('docker', args);

      const timer = setTimeout(() => {
        timedOut = true;
        // Best-effort: if the container already finished, this just fails
        // quietly, and 'close' below has already fired or is about to.
        spawn('docker', ['kill', name]).on('error', () => undefined);
      }, options.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: timedOut ? 124 : (code ?? 1),
          stdout,
          stderr: timedOut ? `${stderr}\ntimed out after ${options.timeoutMs}ms` : stderr,
        });
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ exitCode: 1, stdout, stderr: `docker: ${error.message}` });
      });
    });
  }
}

/**
 * Selects a provider. `hostMounts` is a specific sandbox's, so this is called
 * once per task run, not once at startup — there is no long-lived Compute to
 * hand out ahead of knowing which sandbox it runs against.
 */
export function compute(
  provider: 'docker' | 'none',
  hostMounts: Readonly<Record<Scope, string>>,
  setup: SandboxSetup = {},
): Compute {
  return provider === 'docker' ? new DockerCompute(hostMounts, setup) : NullCompute;
}
