import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '@lumen/contracts';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { notFound } from '../../core/http/httpError.js';
import { createSessionSlice, type ProjectGate, type SessionSlice } from './index.js';

// The walking skeleton, as a test: sign in with the stub, open a session under
// a project, and watch its one task and one step arrive on a socket — the same
// path the browser takes, cookie and all.

const AUTH = { authorization: 'stub acc-1:user' };

let app: FastifyInstance | null = null;

afterEach(async () => {
  const running = app;
  app = null;
  await running?.close();
});

async function build(
  requireProject?: ProjectGate,
): Promise<{ app: FastifyInstance; slice: SessionSlice }> {
  const broker = new Broker();
  const slice = createSessionSlice({ broker, ...(requireProject ? { requireProject } : {}) });
  const built = await buildServer({
    broker,
    resolver: headerStub,
    access: slice.access,
    logLevel: 'silent',
  });
  await built.register(slice.registerRoutes);
  slice.registerCommands(broker);
  await built.ready();
  app = built;
  return { app: built, slice };
}

async function listen(server: FastifyInstance): Promise<string> {
  await server.listen({ port: 0, host: '127.0.0.1' });
  const { port } = server.server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}

function connect(url: string, headers: Record<string, string>): Promise<WebSocket> {
  return new Promise((done, fail) => {
    const socket = new WebSocket(url, { headers });
    socket.once('open', () => done(socket));
    socket.once('error', fail);
  });
}

function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('no frame within 2s')), 2000);
    socket.once('message', (data: Buffer) => {
      clearTimeout(timer);
      done(JSON.parse(data.toString('utf8')));
    });
  });
}

describe('session: routes', () => {
  it('opens a session under a project and answers 201 with the root task', async () => {
    const { app: server } = await build();
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: AUTH,
      payload: { text: 'what changed?' },
    });

    expect(response.statusCode).toBe(201);
    const snapshot = response.json<SessionSnapshot>();
    expect(snapshot.session.projectId).toBe('p1');
    expect(snapshot.tasks[0]?.title).toBe('what changed?');
  });

  it('refuses an empty question and an anonymous caller', async () => {
    const { app: server } = await build();

    const empty = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: AUTH,
      payload: { text: '   ' },
    });
    expect(empty.statusCode).toBe(400);

    const anonymous = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      payload: { text: 'hello' },
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('reads the snapshot back, with the worker step in it, for the owner only', async () => {
    const { app: server, slice } = await build();
    const started = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: AUTH,
      payload: { text: 'q' },
    });
    const { session } = started.json<SessionSnapshot>();
    await slice.kernel.idle();

    const mine = await server.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}`,
      headers: AUTH,
    });
    expect(mine.statusCode).toBe(200);
    expect(mine.json<SessionSnapshot>().tasks).toHaveLength(4);
    expect(mine.json<SessionSnapshot>().spend.dollars).toBeCloseTo(0.03, 6);

    const theirs = await server.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}`,
      headers: { authorization: 'stub acc-2:user' },
    });
    expect(theirs.statusCode).toBe(404);
  });

  it('stops a session and answers 204', async () => {
    const { app: server } = await build();
    const started = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: AUTH,
      payload: { text: 'q' },
    });
    const { session } = started.json<SessionSnapshot>();

    const stopped = await server.inject({
      method: 'POST',
      url: `/api/sessions/${session.id}/stop`,
      headers: AUTH,
    });
    expect(stopped.statusCode).toBe(204);
  });
});

describe('session: what the projects slice is handed', () => {
  const owner = { accountId: 'acc-1', role: 'user' as const };
  const other = { accountId: 'acc-2', role: 'user' as const };
  const staff = { accountId: 'acc-9', role: 'staff' as const };

  it('refuses a session under a project the gate refuses, and leaves nothing behind', async () => {
    const gate: ProjectGate = (_principal, projectId) =>
      projectId === 'mine' ? Promise.resolve() : Promise.reject(notFound('no such project'));
    const { app: server, slice } = await build(gate);
    const post = (project: string): Promise<LightMyRequestResponse> =>
      server.inject({
        method: 'POST',
        url: `/api/projects/${project}/sessions`,
        headers: AUTH,
        payload: { text: 'q' },
      });

    expect((await post('theirs')).statusCode).toBe(404);
    expect(await slice.projects.list('theirs', owner)).toEqual([]);
    expect((await post('mine')).statusCode).toBe(201);
  });

  it('refuses a mode the contract does not know, and takes seed', async () => {
    const { app: server } = await build();
    const post = (mode: unknown): Promise<LightMyRequestResponse> =>
      server.inject({
        method: 'POST',
        url: '/api/projects/p1/sessions',
        headers: AUTH,
        payload: { text: 'q', mode },
      });

    expect((await post('sideways')).statusCode).toBe(400);
    expect((await post('seed')).json<SessionSnapshot>().session.mode).toBe('seed');
  });

  it('starts, lists, finds and stops sessions for the projects slice', async () => {
    const { slice } = await build();
    const { id } = await slice.projects.start('p1', owner, 'question', 'seed');
    await slice.kernel.idle();

    const [summary] = await slice.projects.list('p1', owner);
    expect(summary).toMatchObject({ id, mode: 'seed', status: 'ended' });
    expect(summary?.spend.dollars).toBeCloseTo(0.03, 6);

    expect(await slice.projects.context(id)).toEqual({ projectId: 'p1', accountId: 'acc-1' });
    expect(await slice.projects.context('nope')).toBeNull();
    const root = (await slice.kernel.snapshot(id, owner)).tasks[0]!;
    expect(await slice.projects.taskSession(root.id)).toBe(id);
    expect(await slice.projects.taskSession('nope')).toBeNull();

    // Another account's session under the same project id is not listed for the owner.
    await slice.projects.start('p1', other, 'theirs', 'explore');
    expect(await slice.projects.list('p1', owner)).toHaveLength(1);
    expect(await slice.projects.list('p1', staff)).toHaveLength(2);

    await expect(slice.projects.stop(id, other)).rejects.toMatchObject({ status: 404 });
    await expect(slice.projects.stop(id, owner)).resolves.toBeUndefined();
  });
});

describe('session: the walking skeleton, end to end', () => {
  it('signs in by cookie, opens a session, and sees the step arrive on the socket', async () => {
    const { app: server, slice } = await build();
    const origin = await listen(server);
    const cookie = { cookie: 'lumen_stub=stub acc-1:user' };

    // A browser cannot set a header on a WebSocket; the stub cookie is how the
    // page signs the socket in. A stranger's cookie is refused before upgrade.
    const started = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: cookie,
      payload: { text: 'q' },
    });
    expect(started.statusCode).toBe(201);
    const { session } = started.json<SessionSnapshot>();
    await slice.kernel.idle();

    await expect(
      connect(`ws://${origin}/ws?session=${session.id}`, { cookie: 'lumen_stub=stub acc-2:user' }),
    ).rejects.toThrow(/404/);

    const socket = await connect(`ws://${origin}/ws?session=${session.id}`, cookie);
    const incoming = nextMessage(socket);
    socket.send(JSON.stringify({ type: 'session.say', sessionId: session.id, text: 'more' }));

    const root = started.json<SessionSnapshot>().tasks[0];
    expect(await incoming).toMatchObject({
      type: 'step.appended',
      taskId: root?.id,
      kind: 'you',
      text: 'more',
    });
    socket.terminate();
  });

  it('opens a session over the socket, is sent the snapshot, and catches up the same way after a drop', async () => {
    const { app: server, slice } = await build();
    const origin = await listen(server);
    const cookie = { cookie: 'lumen_stub=stub acc-1:user' };
    const started = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: cookie,
      payload: { text: 'q' },
    });
    const { session } = started.json<SessionSnapshot>();
    await slice.kernel.idle();

    for (const attempt of ['first connection', 'after a drop']) {
      const socket = await connect(`ws://${origin}/ws`, cookie);
      const incoming = nextMessage(socket);
      socket.send(JSON.stringify({ type: 'session.open', sessionId: session.id }));

      const frame = (await incoming) as { type: string; snapshot: SessionSnapshot };
      expect(frame.type, attempt).toBe('session.snapshot');
      expect(frame.snapshot.tasks, attempt).toHaveLength(4);
      expect(frame.snapshot.spend.dollars, attempt).toBeCloseTo(0.03, 6);
      socket.terminate();
    }
  });

  it('tells a stranger who opens the session "no such session", and sends no snapshot', async () => {
    const { app: server } = await build();
    const origin = await listen(server);
    const started = await server.inject({
      method: 'POST',
      url: '/api/projects/p1/sessions',
      headers: AUTH,
      payload: { text: 'q' },
    });
    const { session } = started.json<SessionSnapshot>();

    const socket = await connect(`ws://${origin}/ws`, { authorization: 'stub acc-2:user' });
    const incoming = nextMessage(socket);
    socket.send(JSON.stringify({ type: 'session.open', sessionId: session.id }));

    expect(await incoming).toEqual({ type: 'error', message: 'no such session' });
    socket.terminate();
  });
});
