import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SandboxFs, SandboxPathError, SandboxQuotaError } from './sandboxFs.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

// Creating a symlink on Windows needs Administrator or Developer Mode; neither
// is guaranteed on a contributor's machine. Probed once, synchronously, before
// any test is collected, so `it.skipIf` sees a real answer instead of guessing.
const CAN_SYMLINK = (() => {
  const probe = mkdtempSync(join(tmpdir(), 'lumen-symlink-probe-'));
  try {
    symlinkSync(join(probe, 'target'), join(probe, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

let volumeRoot: string;

beforeEach(async () => {
  volumeRoot = await mkdtemp(join(tmpdir(), 'lumen-sandbox-'));
});

afterEach(async () => {
  await rm(volumeRoot, { recursive: true, force: true });
});

function fs(): SandboxFs {
  return new SandboxFs(volumeRoot, PROJECT, SESSION);
}

describe('SandboxFs: construction', () => {
  it('accepts uuid project and session ids', () => {
    expect(() => fs()).not.toThrow();
  });

  it('refuses a project id that is not a uuid', () => {
    expect(() => new SandboxFs(volumeRoot, '../../etc', SESSION)).toThrow(SandboxPathError);
  });

  it('refuses a session id that is not a uuid', () => {
    expect(() => new SandboxFs(volumeRoot, PROJECT, 'not-a-uuid')).toThrow(SandboxPathError);
  });

  it('lays upload and output at the project, and workspace under the session', () => {
    const mounts = fs().hostMounts;
    expect(mounts.upload).toBe(join(volumeRoot, PROJECT, 'upload'));
    expect(mounts.output).toBe(join(volumeRoot, PROJECT, 'output'));
    expect(mounts.workspace).toBe(join(volumeRoot, PROJECT, 'sessions', SESSION, 'workspace'));
  });

  it('accepts no session id at all — a project-level caller has none to give', () => {
    expect(() => new SandboxFs(volumeRoot, PROJECT)).not.toThrow();
  });
});

describe('SandboxFs: no session (project-level access, e.g. the files route)', () => {
  it('reads and lists upload and output with no session id', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT);
    await sandbox.ensureDirectories();

    await new SandboxFs(volumeRoot, PROJECT, SESSION).writeFile(
      '/mnt/output/report.md',
      Buffer.from('# done'),
    );

    expect((await sandbox.readFile('/mnt/output/report.md')).toString()).toBe('# done');
    expect(await sandbox.list('/mnt/output')).toEqual([
      expect.objectContaining({ name: 'report.md' }),
    ]);
  });

  it('refuses to address workspace when no session id was given', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT);
    await expect(sandbox.readFile('/mnt/workspace/notes.txt')).rejects.toThrow(SandboxPathError);
    await expect(sandbox.usageBytes('workspace')).rejects.toThrow(SandboxPathError);
  });

  it('does not create a workspace directory when no session id was given', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT);
    await sandbox.ensureDirectories();

    await expect(access(join(volumeRoot, PROJECT, 'sessions'))).rejects.toThrow();
  });
});

describe('SandboxFs: reading and writing', () => {
  it('round-trips a file through workspace', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    await sandbox.writeFile('/mnt/workspace/notes.txt', Buffer.from('hello'));
    const back = await sandbox.readFile('/mnt/workspace/notes.txt');

    expect(back.toString('utf8')).toBe('hello');
  });

  it('creates intermediate directories for a nested write', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    await sandbox.writeFile('/mnt/output/reports/summary.md', Buffer.from('# done'));

    expect((await sandbox.readFile('/mnt/output/reports/summary.md')).toString()).toBe('# done');
  });

  it('refuses to write into upload — the agent may only read it', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    await expect(sandbox.writeFile('/mnt/upload/x.txt', Buffer.from('x'))).rejects.toThrow(
      SandboxPathError,
    );
  });

  it('refuses to delete from upload', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    await expect(sandbox.remove('/mnt/upload/x.txt')).rejects.toThrow(SandboxPathError);
  });

  it('lists a directory with name, kind and size', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();
    await sandbox.writeFile('/mnt/workspace/a.txt', Buffer.from('12345'));

    const entries = await sandbox.list('/mnt/workspace');

    expect(entries).toEqual([
      expect.objectContaining({
        name: 'a.txt',
        kind: 'file',
        sizeBytes: 5,
        virtualPath: '/mnt/workspace/a.txt',
      }),
    ]);
  });

  it('lists an empty answer for a directory that does not exist yet, not an error', async () => {
    await expect(fs().list('/mnt/output')).resolves.toEqual([]);
  });
});

describe('SandboxFs: path validation', () => {
  it('refuses a path outside /mnt entirely', async () => {
    await expect(fs().readFile('/etc/passwd')).rejects.toThrow(SandboxPathError);
  });

  it('refuses a null byte', async () => {
    await expect(fs().readFile('/mnt/workspace/a\0.txt')).rejects.toThrow(SandboxPathError);
  });

  it('refuses a literal ".." segment', async () => {
    await expect(fs().readFile('/mnt/workspace/../../../etc/passwd')).rejects.toThrow(
      SandboxPathError,
    );
  });

  it('refuses a reserved Windows device name, with or without an extension', async () => {
    await expect(fs().readFile('/mnt/workspace/CON')).rejects.toThrow(SandboxPathError);
    await expect(fs().readFile('/mnt/workspace/con.txt')).rejects.toThrow(SandboxPathError);
    await expect(fs().readFile('/mnt/workspace/COM1')).rejects.toThrow(SandboxPathError);
  });

  it('refuses a name ending in a dot or a space', async () => {
    await expect(fs().readFile('/mnt/workspace/report.')).rejects.toThrow(SandboxPathError);
    await expect(fs().readFile('/mnt/workspace/report ')).rejects.toThrow(SandboxPathError);
  });

  it('refuses a backslash inside a segment', async () => {
    // On a Windows host, path.resolve treats '\' as a separator even inside
    // what this layer thinks is one segment, so "evil\..\..\..\secrets" is
    // not the literal string ".." and a check that only rejects a whole
    // segment equal to ".." would not see it coming on its own — the final
    // prefix check independently catches the resulting escape on this
    // platform too (confirmed by temporarily removing just this guard), so
    // this assertion is about getting a clear "illegal character" refusal,
    // not about this being the only thing standing between the two.
    await expect(fs().readFile('/mnt/workspace/evil\\..\\..\\..\\secrets')).rejects.toThrow(
      SandboxPathError,
    );
  });

  // Windows only. Elsewhere a backslash is an ordinary filename character and
  // path.resolve leaves it inside root, so there is no escape to prove — the
  // guard above still refuses the segment on every platform, which is the
  // behaviour that matters; this only shows why it was written.
  it.skipIf(process.platform !== 'win32')(
    'shows the platform behaviour the guard above is written for',
    () => {
      // Does not touch SandboxFs — it proves path.resolve really does resolve a
      // backslash-laden segment as a traversal on this OS, so the test above is
      // not guarding against a bug that was never real here.
      const root = join(volumeRoot, PROJECT, 'sessions', SESSION, 'workspace');
      const escaped = resolvePath(root, 'evil\\..\\..\\..\\secrets');
      expect(escaped.startsWith(root)).toBe(false);
    },
  );
});

describe('SandboxFs: quota', () => {
  it('refuses a single file over the configured limit', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION, { maxFileBytes: 10 });
    await sandbox.ensureDirectories();

    await expect(sandbox.writeFile('/mnt/workspace/big.bin', Buffer.alloc(11))).rejects.toThrow(
      SandboxQuotaError,
    );
  });

  it('refuses a write that would push the project over its total', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION, {
      maxFileBytes: 100,
      maxTotalBytes: 15,
    });
    await sandbox.ensureDirectories();

    await sandbox.writeFile('/mnt/workspace/a.bin', Buffer.alloc(10));
    await expect(sandbox.writeFile('/mnt/workspace/b.bin', Buffer.alloc(10))).rejects.toThrow(
      SandboxQuotaError,
    );
  });

  it('does not count the copy a write replaces', async () => {
    const sandbox = new SandboxFs(volumeRoot, PROJECT, SESSION, {
      maxFileBytes: 100,
      maxTotalBytes: 15,
    });
    await sandbox.ensureDirectories();

    await sandbox.writeFile('/mnt/output/table.csv', Buffer.alloc(10));
    await sandbox.writeFile('/mnt/output/table.csv', Buffer.alloc(12));
    await sandbox.saveUpload('data.csv', Buffer.alloc(10));
    await sandbox.saveUpload('data.csv', Buffer.alloc(12));

    expect(await sandbox.usageBytes('output')).toBe(12);
    expect(await sandbox.usageBytes('upload')).toBe(12);
  });

  it('counts real bytes written, across scopes independently', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();
    await sandbox.writeFile('/mnt/workspace/a.bin', Buffer.alloc(30));

    expect(await sandbox.usageBytes('workspace')).toBe(30);
    expect(await sandbox.usageBytes('output')).toBe(0);
  });
});

describe.skipIf(!CAN_SYMLINK)('SandboxFs: symlinks (skipped without symlink privilege)', () => {
  it('refuses to read through a symlink planted inside the sandbox', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    const secretDir = await mkdtemp(join(tmpdir(), 'lumen-secret-'));
    await writeFile(join(secretDir, 'passwd'), 'root:x:0:0');
    await symlink(secretDir, join(sandbox.hostMounts.workspace, 'leak'));

    await expect(sandbox.readFile('/mnt/workspace/leak/passwd')).rejects.toThrow(SandboxPathError);

    await rm(secretDir, { recursive: true, force: true });
  });

  it('refuses to write through a symlinked intermediate directory', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();

    const outsideDir = await mkdtemp(join(tmpdir(), 'lumen-outside-'));
    await symlink(outsideDir, join(sandbox.hostMounts.workspace, 'link'));

    await expect(
      sandbox.writeFile('/mnt/workspace/link/new.txt', Buffer.from('x')),
    ).rejects.toThrow(SandboxPathError);

    await rm(outsideDir, { recursive: true, force: true });
  });

  it('does not list a symlink as if it were a real file', async () => {
    const sandbox = fs();
    await sandbox.ensureDirectories();
    await sandbox.writeFile('/mnt/workspace/real.txt', Buffer.from('x'));

    const outsideDir = await mkdtemp(join(tmpdir(), 'lumen-outside-'));
    await symlink(outsideDir, join(sandbox.hostMounts.workspace, 'link'));

    const entries = await sandbox.list('/mnt/workspace');

    expect(entries.map((e) => e.name)).toEqual(['real.txt']);

    await rm(outsideDir, { recursive: true, force: true });
  });
});
