import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { anySignedInMayWatch, headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createSteeringSlice } from './index.js';
import { SandboxFs } from './sandboxFs.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const AUTH = { authorization: 'stub acc-1:user' };

let volumeRoot: string;
let app: FastifyInstance | null = null;

beforeEach(async () => {
  volumeRoot = await mkdtemp(join(tmpdir(), 'lumen-steering-routes-'));
});

afterEach(async () => {
  const running = app;
  app = null;
  await running?.close();
  await rm(volumeRoot, { recursive: true, force: true });
});

async function build(): Promise<FastifyInstance> {
  const slice = createSteeringSlice({ volumeRoot });
  const built = await buildServer({
    broker: new Broker(), // the files routes never touch it; buildServer just needs one
    resolver: headerStub,
    access: anySignedInMayWatch,
    logLevel: 'silent',
  });
  await built.register(slice.registerRoutes);
  await built.ready();
  app = built;
  return built;
}

describe('steering: files routes', () => {
  it('refuses an anonymous request', async () => {
    const server = await build();
    const response = await server.inject({ method: 'GET', url: `/api/projects/${PROJECT}/files` });
    expect(response.statusCode).toBe(401);
  });

  it('lists an empty upload for a project that has none yet', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('lists a file placed directly on the volume, defaulting to the upload scope', async () => {
    const seed = new SandboxFs(volumeRoot, PROJECT);
    await seed.ensureDirectories();
    // upload is agent-read-only, not caller-write-only — seed it straight on disk,
    // the way a real upload flow (not built yet) eventually would too.
    await writeFile(join(seed.hostMounts.upload, 'brief.md'), '# brief');

    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ name: 'brief.md', virtualPath: '/mnt/upload/brief.md' }),
    ]);
  });

  it('lists the output scope on request', async () => {
    const seed = new SandboxFs(volumeRoot, PROJECT);
    await seed.ensureDirectories();
    await writeFile(join(seed.hostMounts.output, 'result.txt'), 'done');

    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files?scope=output`,
      headers: AUTH,
    });

    expect(response.json()).toEqual([expect.objectContaining({ name: 'result.txt' })]);
  });

  it('refuses a scope that is not upload or output', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files?scope=workspace`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(400);
  });

  it('reads one file back through the wildcard route', async () => {
    const seed = new SandboxFs(volumeRoot, PROJECT);
    await seed.ensureDirectories();
    await writeFile(join(seed.hostMounts.output, 'result.txt'), 'done');

    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files/output/result.txt`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('done');
  });

  it('answers 404, not 500, for a file that does not exist', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files/output/missing.txt`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(404);
  });

  it('answers 404, not 500, for the workspace scope — there is no session here to name', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files/workspace/notes.txt`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(404);
  });

  it('answers 404, not 500, for a project id that is not a uuid', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'GET',
      url: `/api/projects/not-a-uuid/files`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('steering: attaching a file', () => {
  it('writes the body to /mnt/upload under a safe name, where the agents can read it', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT}/upload/${encodeURIComponent('../My Paper (v2).pdf')}`,
      headers: { ...AUTH, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('%PDF-1.7'),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ path: '/mnt/upload/My-Paper-v2-.pdf' });
    const saved = await new SandboxFs(volumeRoot, PROJECT).readFile('/mnt/upload/My-Paper-v2-.pdf');
    expect(saved.toString()).toBe('%PDF-1.7');
  });

  it('keeps letters of any script in the name', async () => {
    const server = await build();
    const response = await server.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT}/upload/${encodeURIComponent('数据 表 v2.csv')}`,
      headers: { ...AUTH, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('x,y'),
    });
    expect(response.json()).toEqual({ path: '/mnt/upload/数据-表-v2.csv' });
  });

  it('refuses a stranger and a body that is not raw bytes', async () => {
    const server = await build();
    const anonymous = await server.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT}/upload/a.txt`,
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('x'),
    });
    expect(anonymous.statusCode).toBe(401);
    const json = await server.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT}/upload/a.txt`,
      headers: AUTH,
      payload: { x: 1 },
    });
    expect(json.statusCode).toBe(400);
  });
});

describe('steering: opening a kept file', () => {
  it('serves a table as plain text in the tab, and anything else as a download', async () => {
    const fs = new SandboxFs(volumeRoot, PROJECT);
    await fs.writeFile('/mnt/output/table.csv', Buffer.from('n,a\n1,1\n'));
    await fs.writeFile('/mnt/output/page.html', Buffer.from('<script>x</script>'));
    const server = await build();
    const table = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files/output/table.csv`,
      headers: AUTH,
    });
    expect(table.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(table.headers['x-content-type-options']).toBe('nosniff');
    expect(table.body).toBe('n,a\n1,1\n');
    const page = await server.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT}/files/output/page.html`,
      headers: AUTH,
    });
    expect(page.headers['content-type']).toBe('application/octet-stream');
    expect(page.headers['content-disposition']).toBe('attachment');
  });
});
