import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '@lumen/contracts';
import type { FastifyInstance } from 'fastify';
import { headerStub } from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createSessionSlice, type SessionSlice } from './index.js';

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

async function build(): Promise<{ app: FastifyInstance; slice: SessionSlice }> {
  const broker = new Broker();
  const slice = createSessionSlice({ broker });
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
    expect(mine.json<SessionSnapshot>().steps).toHaveLength(1);

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
    expect(await incoming).toEqual({
      type: 'step.appended',
      taskId: root?.id,
      index: 1,
      text: 'you: more',
    });
    socket.terminate();
  });
});
