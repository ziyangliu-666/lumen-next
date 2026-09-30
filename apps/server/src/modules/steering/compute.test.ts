import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compute, DockerCompute, dockerArgs, NullCompute } from './compute.js';
import { SandboxFs } from './sandboxFs.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

// Probed once, synchronously, before Vitest collects the suite — same
// discipline as sandboxFs.test.ts's CAN_SYMLINK: skip, do not fake, when the
// machine cannot actually run a container.
const DOCKER_AVAILABLE = (() => {
  try {
    return spawnSync('docker', ['info'], { timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
})();

describe('NullCompute', () => {
  it('answers a readable failure and never throws', async () => {
    const result = await NullCompute.run('anything', { cwd: '/mnt/workspace', timeoutMs: 1000 });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/no compute provider/);
    expect(result.stdout).toBe('');
  });
});

describe('compute() factory', () => {
  const mounts = { upload: '/u', workspace: '/w', output: '/o' } as const;

  it("selects NullCompute for 'none'", () => {
    expect(compute('none', mounts)).toBe(NullCompute);
  });

  it('runs the container without root, network or capabilities, and with process and CPU caps', () => {
    const args = dockerArgs({
      name: 'lumen-1',
      image: 'alpine:3',
      memory: '256m',
      hostMounts: { upload: '/h/u', workspace: '/h/w', output: '/h/o' },
      cwd: '/mnt/workspace',
      command: 'df -h',
      user: '1000:1000',
    });
    const flag = (name: string): string | undefined => args[args.indexOf(name) + 1];
    expect(flag('--network')).toBe('none');
    expect(flag('--user')).toBe('1000:1000');
    expect(flag('--pids-limit')).toBe('256');
    expect(flag('--cpus')).toBe('1');
    expect(flag('--cap-drop')).toBe('ALL');
    expect(flag('--security-opt')).toBe('no-new-privileges');
    expect(args).toContain('/h/u:/mnt/upload:ro');
    expect(args.slice(-3)).toEqual(['sh', '-c', 'df -h']);
    // Every flag comes before the image, so the command cannot add one.
    expect(args.indexOf('alpine:3')).toBeGreaterThan(args.lastIndexOf('--security-opt'));
  });

  it("selects a DockerCompute for 'docker'", () => {
    expect(compute('docker', mounts)).toBeInstanceOf(DockerCompute);
  });
});

describe.skipIf(!DOCKER_AVAILABLE)(
  'DockerCompute (skipped without a reachable Docker daemon)',
  () => {
    let volumeRoot: string;

    beforeEach(async () => {
      volumeRoot = await mkdtemp(join(tmpdir(), 'lumen-compute-'));
    });

    afterEach(async () => {
      await rm(volumeRoot, { recursive: true, force: true });
    });

    it('runs a command and captures its stdout', async () => {
      const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
      await sandbox.ensureDirectories();
      const docker = new DockerCompute(sandbox.hostMounts);

      const result = await docker.run('echo hello-from-container', {
        cwd: '/mnt/workspace',
        timeoutMs: 30_000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello-from-container');
    }, 60_000);

    it('has no network', async () => {
      const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
      await sandbox.ensureDirectories();
      const docker = new DockerCompute(sandbox.hostMounts);

      const result = await docker.run('wget -T 3 -q -O- http://example.com || echo blocked', {
        cwd: '/mnt/workspace',
        timeoutMs: 30_000,
      });

      expect(result.stdout.trim()).toBe('blocked');
    }, 60_000);

    it('writes a file into the workspace bind mount, visible on the host', async () => {
      const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
      await sandbox.ensureDirectories();
      const docker = new DockerCompute(sandbox.hostMounts);

      await docker.run('echo from-container > /mnt/workspace/out.txt', {
        cwd: '/mnt/workspace',
        timeoutMs: 30_000,
      });

      expect((await sandbox.readFile('/mnt/workspace/out.txt')).toString().trim()).toBe(
        'from-container',
      );
    }, 60_000);

    it('kills a command that runs past its timeout', async () => {
      const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION);
      await sandbox.ensureDirectories();
      const docker = new DockerCompute(sandbox.hostMounts);

      const result = await docker.run('sleep 30', { cwd: '/mnt/workspace', timeoutMs: 2000 });

      expect(result.exitCode).toBe(124);
    }, 30_000);
  },
);
