import { dirname, join, resolve, sep } from 'node:path';
import {
  lstat,
  mkdir,
  readdir,
  readFile as fsReadFile,
  rm,
  stat,
  writeFile as fsWriteFile,
} from 'node:fs/promises';

// Translates the flat /mnt/{upload,workspace,output} namespace an agent sees
// inside its sandbox into real paths on the host volume, and refuses anything
// that would leave those three directories.
//
// `upload` and `output` are per project — a file outlives the session that
// made it. `workspace` is per session — scratch space, safe to lose on a
// restart:
//
//   <volumeRoot>/<projectId>/upload/
//   <volumeRoot>/<projectId>/output/
//   <volumeRoot>/<projectId>/sessions/<sessionId>/workspace/
//
// Nothing here talks to Docker, and nothing here knows an agent exists. It is
// path arithmetic plus a filesystem, which is what makes the interesting cases
// — traversal, a symlink the agent planted, a reserved Windows name — testable
// without a container.

export type Scope = 'upload' | 'workspace' | 'output';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Windows reserved device names, with or without an extension, case-insensitive.
// The team develops on Windows, and a file an agent names "con.log" does not
// behave like an ordinary file there.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

// Control characters, the Windows-illegal set, and the backslash. Segments are
// already split on '/', so on a Windows host a literal '\' here is not inert —
// path.resolve there treats it as a separator, so a single segment such as
// "a\\..\\..\\b" resolves as if it were three real segments. The final prefix
// check below happens to catch the escape that produces on this platform too
// (verified: removing only this line still fails closed there), so this is a
// second, independent layer rather than the sole barrier — worth having in
// case that check is ever refactored, and it is what turns the failure into a
// clear "illegal character" instead of a bare "escape attempt".
// eslint-disable-next-line no-control-regex
const ILLEGAL_SEGMENT_CHARS = /[\u0000-\u001f<>:"\\|?*]/;

const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB per project

export class SandboxPathError extends Error {}
export class SandboxQuotaError extends Error {}

export interface FileEntry {
  readonly name: string;
  readonly virtualPath: string;
  readonly kind: 'file' | 'directory';
  readonly sizeBytes: number;
  readonly modifiedAt: number;
}

export interface SandboxFsOptions {
  readonly maxFileBytes?: number;
  readonly maxTotalBytes?: number;
}

interface ParsedPath {
  readonly scope: Scope;
  readonly subPath: string;
  readonly host: string;
}

function isNoEnt(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT'
  );
}

/**
 * The bytes a write takes back: the file it replaces. Without this, the old
 * copy counted against the quota, so saving a table again near the limit
 * was refused although the project would not grow.
 */
async function replacedBytes(host: string): Promise<number> {
  try {
    const info = await lstat(host);
    return info.isFile() ? info.size : 0;
  } catch {
    // Nothing there to replace. A path that cannot hold a file fails in
    // the write itself, with the error the agent should hear.
    return 0;
  }
}

async function walkSizeBytes(root: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNoEnt(error)) return 0;
    throw error;
  }
  let total = 0;
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) continue; // never counted as content, never followed
    if (entry.isDirectory()) total += await walkSizeBytes(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
}

export class SandboxFs {
  private readonly maxFileBytes: number;
  private readonly maxTotalBytes: number;
  private readonly roots: Readonly<Record<Scope, string>>;
  /** False when constructed with no sessionId — `upload`/`output` only, e.g. the project-level files route. */
  private readonly hasSession: boolean;

  /**
   * `sessionId` is optional: a caller that only ever touches `upload`/`output`
   * (the project-level files endpoint, not a running sandbox) has no session
   * to name. Any call that resolves to the `workspace` scope without one
   * fails clearly, from `parse()`, before it can touch a path built from a
   * project id alone.
   */
  constructor(
    volumeRoot: string,
    projectId: string,
    sessionId?: string,
    options: SandboxFsOptions = {},
  ) {
    // projectId and sessionId become path segments below. Something that is not
    // a uuid here is either a bug upstream or an attempt at traversal — "../../etc"
    // is not a valid uuid either — so this is refused at construction, not at
    // the first call that happens to build a path with it.
    if (!UUID.test(projectId)) throw new SandboxPathError(`not a uuid: projectId "${projectId}"`);
    if (sessionId !== undefined && !UUID.test(sessionId)) {
      throw new SandboxPathError(`not a uuid: sessionId "${sessionId}"`);
    }

    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
    this.hasSession = sessionId !== undefined;

    const project = resolve(volumeRoot, projectId);
    this.roots = {
      upload: resolve(project, 'upload'),
      output: resolve(project, 'output'),
      // Never read when !hasSession (parse() throws first) — resolved anyway
      // so `roots` stays a plain, fully-populated Record with no null case
      // for every other method to guard against.
      workspace: resolve(project, 'sessions', sessionId ?? '(no-session)', 'workspace'),
    };
  }

  /** The three host directories to bind-mount at /mnt/upload, /mnt/workspace, /mnt/output. */
  get hostMounts(): Readonly<Record<Scope, string>> {
    return this.roots;
  }

  async ensureDirectories(): Promise<void> {
    const scopes: readonly Scope[] = this.hasSession
      ? ['upload', 'output', 'workspace']
      : ['upload', 'output'];
    for (const scope of scopes) await mkdir(this.roots[scope], { recursive: true });
  }

  async list(virtualPath = '/mnt/workspace'): Promise<FileEntry[]> {
    const { scope, subPath, host } = this.parse(virtualPath);
    await this.rejectSymlinkedAncestors(host, this.roots[scope]);

    let entries;
    try {
      entries = await readdir(host, { withFileTypes: true });
    } catch (error) {
      if (isNoEnt(error)) return [];
      throw error;
    }

    const results: FileEntry[] = [];
    for (const entry of entries) {
      const info = await lstat(join(host, entry.name));
      if (info.isSymbolicLink()) continue; // never presented as if it were real content
      results.push({
        name: entry.name,
        virtualPath: `/mnt/${scope}${subPath}/${entry.name}`.replace(/\/{2,}/g, '/'),
        kind: info.isDirectory() ? 'directory' : 'file',
        sizeBytes: info.size,
        modifiedAt: info.mtimeMs,
      });
    }
    return results;
  }

  async readFile(virtualPath: string): Promise<Buffer> {
    const { scope, host } = this.parse(virtualPath);
    await this.rejectSymlinkedAncestors(host, this.roots[scope]);
    return fsReadFile(host);
  }

  async writeFile(virtualPath: string, data: Buffer): Promise<void> {
    const { scope, host } = this.parse(virtualPath);
    if (scope === 'upload') throw new SandboxPathError('upload is read-only to the agent');
    if (virtualPath.endsWith('/'))
      throw new SandboxPathError('a directory-shaped path is not a file');

    if (data.byteLength > this.maxFileBytes) {
      throw new SandboxQuotaError(`file exceeds ${this.maxFileBytes} bytes`);
    }
    const used = (await this.usageBytes(scope)) - (await replacedBytes(host));
    if (used + data.byteLength > this.maxTotalBytes) {
      throw new SandboxQuotaError(`project would exceed ${this.maxTotalBytes} bytes`);
    }

    // A missing component — including the leaf itself, the normal case for a
    // new file — ends the check early: nothing below a path that does not
    // exist yet can be an existing symlink.
    await this.rejectSymlinkedAncestors(host, this.roots[scope]);
    await mkdir(dirname(host), { recursive: true });
    await fsWriteFile(host, data);
  }

  /**
   * A file the user attached, written to /mnt/upload/<name>. The agents only
   * read that folder; the person is the one who writes it. The name is
   * reduced to its last part and to safe characters, so an upload cannot
   * name a path, and the same quotas as the agents' writes apply.
   */
  async saveUpload(name: string, data: Buffer): Promise<string> {
    const safe = (name.split(/[\\/]/).pop() ?? '')
      // Letters and digits of any script stay: a Chinese file name lost
      // every character and came back as "v2.csv".
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^[.-]+/, '')
      .slice(0, 120);
    if (!safe) throw new SandboxPathError('the file needs a name');
    if (data.byteLength > this.maxFileBytes) {
      throw new SandboxQuotaError(`file exceeds ${this.maxFileBytes} bytes`);
    }
    const virtualPath = `/mnt/upload/${safe}`;
    const { host } = this.parse(virtualPath);
    const used = (await this.usageBytes('upload')) - (await replacedBytes(host));
    if (used + data.byteLength > this.maxTotalBytes) {
      throw new SandboxQuotaError(`project would exceed ${this.maxTotalBytes} bytes`);
    }
    await this.rejectSymlinkedAncestors(host, this.roots.upload);
    await mkdir(dirname(host), { recursive: true });
    await fsWriteFile(host, data);
    return virtualPath;
  }

  async remove(virtualPath: string): Promise<void> {
    const { scope, host } = this.parse(virtualPath);
    if (scope === 'upload') throw new SandboxPathError('upload is read-only to the agent');
    await this.rejectSymlinkedAncestors(host, this.roots[scope]);
    await rm(host, { recursive: true, force: false });
  }

  /**
   * Total bytes currently stored under one scope. Walks the tree; good enough
   * for now; a durable counter belongs in the database once tasks and
   * spend are persisted there too.
   */
  async usageBytes(scope: Scope): Promise<number> {
    if (scope === 'workspace' && !this.hasSession) {
      throw new SandboxPathError('no session id given, cannot address workspace');
    }
    return walkSizeBytes(this.roots[scope]);
  }

  // --- internal ---

  private parse(virtualPath: string): ParsedPath {
    if (virtualPath.includes('\0')) throw new SandboxPathError('illegal path');
    const match = /^\/mnt\/(upload|workspace|output)(\/.*)?$/.exec(virtualPath);
    if (!match) throw new SandboxPathError(`path is outside /mnt: ${virtualPath}`);
    const scope = match[1] as Scope;
    if (scope === 'workspace' && !this.hasSession) {
      throw new SandboxPathError('no session id given, cannot address workspace');
    }
    const rawSub = match[2] ?? '';
    const host = this.resolveWithin(scope, rawSub);
    return { scope, subPath: rawSub.replace(/\/+$/, ''), host };
  }

  private resolveWithin(scope: Scope, subPath: string): string {
    const root = this.roots[scope];
    // Split on '/' only: the virtual namespace is POSIX-shaped regardless of
    // the host OS. A bare '.' is harmless to path.resolve but is rejected here
    // too, so there is exactly one way to mean "this directory", not two.
    const segments = subPath.split('/').filter((segment) => segment.length > 0);
    for (const segment of segments) {
      if (segment === '.' || segment === '..') {
        throw new SandboxPathError(`"${segment}" is not allowed`);
      }
      if (ILLEGAL_SEGMENT_CHARS.test(segment)) {
        throw new SandboxPathError(`illegal character in "${segment}"`);
      }
      if (segment.endsWith('.') || segment.endsWith(' ')) {
        // Windows silently strips a trailing dot or space, so the name written
        // and the name later read back can silently differ.
        throw new SandboxPathError(`"${segment}" ends in a dot or space`);
      }
      if (WINDOWS_RESERVED.test(segment)) {
        throw new SandboxPathError(`reserved name: "${segment}"`);
      }
    }

    const host = resolve(root, ...segments);
    if (host !== root && !host.startsWith(root + sep)) {
      throw new SandboxPathError(`escape attempt: ${subPath}`);
    }
    return host;
  }

  /**
   * Refuses a path if any component between the scope root and the target is a
   * symlink. An agent can `ln -s /etc leak` inside its own workspace and then
   * ask to read "leak/passwd"; a prefix check on the resolved string alone does
   * not catch that, because the string never mentions /etc — only walking the
   * real filesystem does.
   *
   * This is TOCTOU-imperfect: the link could be swapped between this check and
   * the real read/write that follows it. Closing that fully needs O_NOFOLLOW
   * opens, which is a follow-up once this runs against content an attacker
   * controls concurrently rather than a single agent's own script.
   */
  private async rejectSymlinkedAncestors(host: string, root: string): Promise<void> {
    const rel = host === root ? '' : host.slice(root.length + 1);
    const segments = rel.length > 0 ? rel.split(sep) : [];
    let current = root;
    for (const segment of segments) {
      current = join(current, segment);
      let info;
      try {
        info = await lstat(current);
      } catch (error) {
        if (isNoEnt(error)) return; // nothing below a path that does not exist can be a symlink
        throw error;
      }
      if (info.isSymbolicLink()) throw new SandboxPathError(`symlink in path: ${current}`);
    }
  }
}
