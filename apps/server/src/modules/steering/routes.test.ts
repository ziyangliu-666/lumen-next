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
