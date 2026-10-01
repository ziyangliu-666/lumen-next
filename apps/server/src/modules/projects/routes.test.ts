import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { capture } from '../../core/log/testLog.js';
import type { Log } from '../../core/log/log.js';
import { createSessionSlice } from '../session/index.js';
import { createProjectsSlice } from './index.js';
import type { ProjectSessions } from './ports.js';
import type { LatestSession } from './models.js';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup(log?: Log): Promise<{ app: FastifyInstance; sessions: ProjectSessions }> {
  const broker = new Broker();
  const session = createSessionSlice({ broker });
  const sessions: ProjectSessions = {
    start: vi.fn().mockResolvedValue({ id: randomUUID() }),
    list: vi.fn().mockResolvedValue([]),
    stop: vi.fn().mockResolvedValue(undefined),
    context: vi.fn().mockResolvedValue(null),
    taskSession: vi.fn().mockResolvedValue(null),
  };
  const app = await buildServer({ broker, resolver: headerStub, access: session.access });
  apps.push(app);
  await app.register(createProjectsSlice({ sessions, ...(log ? { log } : {}) }).registerRoutes);
  return { app, sessions };
}
const headers = { authorization: 'stub alice:user' };
describe('projects HTTP boundary', () => {
  it('uses the supplied slice logger without recording question or finding text', async () => {
    const { log, lines } = capture();
    const { app } = await setup(log);
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { question: 'private question test@example.com', mode: 'seed' },
    });
    const { project } = created.json<{ project: { id: string } }>();
    await app.inject({ method: 'POST', url: `/api/projects/${project.id}/visit`, headers });
    expect(lines()).toMatchObject([
      { slice: 'projects', msg: 'project created', projectId: project.id },
      { slice: 'projects', msg: 'project visited', projectId: project.id },
    ]);
    expect(JSON.stringify(lines())).not.toContain('private question');
    expect(JSON.stringify(lines())).not.toContain('test@example.com');
  });
  it('records owner visits, rejects foreign or anonymous writes and ignores no client timestamps', async () => {
    const { app } = await setup();
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { question: 'Visit test', mode: 'seed' },
    });
    const { project } = created.json<{ project: { id: string } }>();
    const url = `/api/projects/${project.id}/visit`;
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url, headers: { authorization: 'stub bob:user' } }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url, headers, payload: { lastOpenedAt: 0 } })).statusCode,
    ).toBe(400);
    const visit = await app.inject({ method: 'POST', url, headers });
    expect(visit.statusCode).toBe(200);
    expect(visit.headers['cache-control']).toBe('no-store');
    const card = await app.inject({ url: `/api/projects/${project.id}`, headers });
    expect(card.json()).toMatchObject({
      item: {
        lastOpenedAt: visit.json<{ lastOpenedAt: number }>().lastOpenedAt,
        sinceLastVisit: { sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0 } },
      },
    });
    expect(card.body).not.toContain('spendAtVisit');
  });
  it('requires a principal, including before malformed resource lookup', async () => {
    const { app } = await setup();
    for (const url of [
      '/api/projects',
      '/api/projects/nope',
      `/api/projects/${randomUUID()}/findings`,
    ]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    }
  });
  it('creates then lists without exposing account ownership and prevents foreign reads', async () => {
    const { app } = await setup();
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { question: '  Research\nquestion  ', mode: 'seed' },
    });
    expect(created.statusCode).toBe(201);
    const { project } = created.json<{ project: { id: string } }>();
    expect(created.headers.location).toBe(`/api/projects/${project.id}`);
    const list = await app.inject({ method: 'GET', url: '/api/projects', headers });
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.json<{ items: unknown[] }>().items).toHaveLength(1);
    expect(list.body).not.toContain('accountId');
    const other = { authorization: 'stub bob:staff' };
    expect(
      (await app.inject({ method: 'GET', url: `/api/projects/${project.id}`, headers: other }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/stop`,
          headers: other,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/projects/${project.id}/findings`,
          headers: other,
        })
      ).statusCode,
    ).toBe(404);
  });
  it.each([
    'limit=0',
    'limit=101',
    'limit=1.5',
    'limit=2&limit=3',
    'cursor=',
    'cursor=not-json',
    'unknown=x',
  ])('rejects invalid pagination %s', async (query) => {
    const { app } = await setup();
    expect(
      (await app.inject({ method: 'GET', url: `/api/projects?${query}`, headers })).statusCode,
    ).toBe(400);
  });
  it('rejects extra body fields and unsupported content types', async () => {
    const { app, sessions } = await setup();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { question: 'x', mode: 'explore', accountId: 'bob' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/projects',
          headers: { ...headers, 'content-type': 'application/xml' },
          payload: '<x />',
        })
      ).statusCode,
    ).toBe(415);
    expect(sessions.start).not.toHaveBeenCalled();
  });
  it('acknowledges stop requests without asserting a final status', async () => {
    const { app, sessions } = await setup();
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { question: 'x', mode: 'explore' },
    });
    const { project } = created.json<{ project: { id: string } }>();
    const url = `/api/projects/${project.id}/stop`;
    expect((await app.inject({ method: 'POST', url, headers })).json()).toMatchObject({
      outcome: 'no_session',
    });
    const latest: LatestSession = {
      id: randomUUID(),
      mode: 'explore',
      status: 'running',
      spend: { dollars: 0 },
      startedAt: 1,
      endedAt: null,
    };
    vi.mocked(sessions.list).mockResolvedValue([latest]);
    const stopped = await app.inject({ method: 'POST', url, headers, payload: {} });
    expect(stopped.statusCode).toBe(202);
    expect(stopped.json()).toMatchObject({ sessionId: latest.id, outcome: 'stop_requested' });
    expect(
      (await app.inject({ method: 'POST', url, headers, payload: { accountId: 'bob' } }))
        .statusCode,
    ).toBe(400);
  });
  it('maps session outages to a safe 503 and accepts the existing stub cookie', async () => {
    const { app, sessions } = await setup();
    vi.mocked(sessions.start).mockRejectedValue(new Error('SECRET connection string'));
    const result = await app.inject({
      method: 'POST',
      url: '/api/projects',
      cookies: { lumen_stub: 'stub alice:user' },
      payload: { question: 'x', mode: 'seed' },
    });
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('SECRET');
    expect(
      (await app.inject({ method: 'GET', url: '/api/projects', headers })).json<{
        items: unknown[];
      }>().items,
    ).toHaveLength(0);
  });
});
