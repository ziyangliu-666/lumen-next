import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClientCommand, ServerEvent } from '@lumen/contracts';
import type { FastifyInstance } from 'fastify';
import { makeTask } from '../domain/task.js';
import { Broker } from '../protocol/broker.js';
import {
  anySignedInMayWatch,
  headerStub,
  requireStaff,
  requireUser,
  type SessionAccess,
} from './authGuard.js';
import { notFound } from './httpError.js';
import { buildServer } from './server.js';

// Routes go through app.inject(), which needs no port. The event stream does
// not: whether a disconnect actually unsubscribes is the behaviour that matters
// most here, and an injected transport does not reproduce it faithfully — an
// in-memory harness reported a leak on a graceful close() that a real socket
// does not have. So the socket tests open a real ephemeral port.

const opened: ServerEvent = {
  type: 'task.opened',
  task: makeTask('t1', 's1', null, 'lead', '', 0),
};

const AUTH = { authorization: 'stub acc-1:user' };

let app: FastifyInstance | null = null;

afterEach(async () => {
  const running = app;
  app = null;
  await running?.close();
});

interface Harness {
  readonly app: FastifyInstance;
  readonly broker: Broker;
  readonly received: ClientCommand[];
}

async function build(
  webRoot?: string,
  access: SessionAccess = anySignedInMayWatch,
): Promise<Harness> {
  const broker = new Broker();
  const received: ClientCommand[] = [];
  broker.onCommand('session.say', (command) => {
    received.push(command);
  });

  const built = await buildServer({
    broker,
    resolver: headerStub,
    access,
    logLevel: 'silent',
    ...(webRoot === undefined ? {} : { webRoot }),
  });

  built.get('/api/health', () => ({ status: 'ok' }));
  built.get('/api/me', (request) => requireUser(request));
  built.get('/api/admin', (request) => requireStaff(request));
  built.get('/api/missing', () => {
    throw notFound('no such task');
  });
  built.get('/api/bug', () => {
    throw new Error('a real bug');
  });
  built.post('/api/echo', (request) => request.body);
  built.get('/api/go', (_request, reply) => reply.redirect('https://example.invalid/authorize'));
  built.post('/api/signin', (_request, reply) =>
    reply
      .setCookie('sid', 'abc', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 3600 })
      .send({ ok: true }),
  );

  await built.ready();
  app = built;
  return { app: built, broker, received };
}

/** Start listening and hand back the origin. Only the socket tests need this. */
async function listen(harness: Harness): Promise<string> {
  await harness.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = harness.app.server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}

function connect(url: string, headers: Record<string, string> = {}): Promise<WebSocket> {
  return new Promise((done, fail) => {
    const socket = new WebSocket(url, { headers });
    socket.once('open', () => done(socket));
    socket.once('error', fail);
  });
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('no frame within 2s')), 2000);
    socket.once('message', (data: Buffer) => {
      clearTimeout(timer);
      done(data.toString('utf8'));
    });
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition was not met in time');
    await new Promise((done) => setTimeout(done, 10));
  }
}

describe('core: routes', () => {
  it('serves a registered route as JSON', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers an unknown path with JSON, not HTML', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'no such route' });
  });

  it('resolves the principal before the handler runs', async () => {
    const { app: server } = await build();

    const signedIn = await server.inject({ method: 'GET', url: '/api/me', headers: AUTH });
    expect(signedIn.json()).toEqual({ accountId: 'acc-1', role: 'user' });

    const anonymous = await server.inject({ method: 'GET', url: '/api/me' });
    expect(anonymous.statusCode).toBe(401);
  });

  it('turns a staff-only route into 403 for a plain user', async () => {
    const { app: server } = await build();

    const asUser = await server.inject({ method: 'GET', url: '/api/admin', headers: AUTH });
    expect(asUser.statusCode).toBe(403);

    const asStaff = await server.inject({
      method: 'GET',
      url: '/api/admin',
      headers: { authorization: 'stub acc-2:staff' },
    });
    expect(asStaff.statusCode).toBe(200);
  });

  it('carries an HttpError status and message through', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'GET', url: '/api/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'no such task' });
  });

  it('turns an unexpected throw into a 500 that says nothing about us', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'GET', url: '/api/bug' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'internal error' });
  });

  it('parses a JSON body and refuses one that is not JSON', async () => {
    const { app: server } = await build();

    const good = await server.inject({ method: 'POST', url: '/api/echo', payload: { a: 1 } });
    expect(good.json()).toEqual({ a: 1 });

    const bad = await server.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{oops',
    });
    expect(bad.statusCode).toBe(400);
  });

  it('sends a redirect with a Location and no body', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'GET', url: '/api/go' });

    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe('https://example.invalid/authorize');
  });

  it('sets a cookie that is HttpOnly and SameSite', async () => {
    const { app: server } = await build();
    const response = await server.inject({ method: 'POST', url: '/api/signin' });

    const cookie = String(response.headers['set-cookie'] ?? '');
    expect(cookie).toContain('sid=abc');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(response.json()).toEqual({ ok: true });
  });

  it('serves the built web app when there is one', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lumen-web-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>lumen</title>');
    const { app: server } = await build(root);

    const page = await server.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('lumen');
  });

  it('refuses to serve a file outside the web root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lumen-web-'));
    writeFileSync(join(root, 'index.html'), 'ok');
    const { app: server } = await build(root);

    const escaped = await server.inject({ method: 'GET', url: '/..%2f..%2fpackage.json' });
    expect(escaped.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('core: the event stream', () => {
  it('refuses an upgrade without a principal', async () => {
    const harness = await build();
    const origin = await listen(harness);

    await expect(connect(`ws://${origin}/ws?session=s1`)).rejects.toThrow(/401/);
  });

  it('upgrades without naming a session, and watches nothing until it opens one', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws`, AUTH);

    expect(harness.broker.subscriberCount('s1')).toBe(0);

    socket.send(JSON.stringify({ type: 'session.open', sessionId: 's1' }));
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    const incoming = nextMessage(socket);
    harness.broker.publish('s1', opened);
    expect(JSON.parse(await incoming)).toMatchObject({ type: 'task.opened' });
    socket.terminate();
  });

  it('answers session.open for a session this principal may not watch with an error, and subscribes to nothing', async () => {
    const onlyS1: SessionAccess = { canWatch: (_p, id) => Promise.resolve(id === 's1') };
    const harness = await build(undefined, onlyS1);
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws`, AUTH);

    const incoming = nextMessage(socket);
    socket.send(JSON.stringify({ type: 'session.open', sessionId: 's2' }));

    expect(JSON.parse(await incoming)).toEqual({ type: 'error', message: 'no such session' });
    expect(harness.broker.subscriberCount('s2')).toBe(0);
    socket.terminate();
  });

  it('watches two sessions on one socket, and session.close lets go of one', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws`, AUTH);

    socket.send(JSON.stringify({ type: 'session.open', sessionId: 's1' }));
    socket.send(JSON.stringify({ type: 'session.open', sessionId: 's2' }));
    await waitUntil(
      () =>
        harness.broker.subscriberCount('s1') === 1 && harness.broker.subscriberCount('s2') === 1,
    );

    socket.send(JSON.stringify({ type: 'session.close', sessionId: 's1' }));
    await waitUntil(() => harness.broker.subscriberCount('s1') === 0);
    expect(harness.broker.subscriberCount('s2')).toBe(1);

    socket.close();
    await waitUntil(() => harness.broker.subscriberCount('s2') === 0);
  });

  it('opening the same session twice subscribes once', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);

    socket.send(JSON.stringify({ type: 'session.open', sessionId: 's1' }));
    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'after' }));
    await waitUntil(() => harness.received.length === 1);

    expect(harness.broker.subscriberCount('s1')).toBe(1);
    socket.terminate();
  });

  it('delivers an event published to the session the socket watches', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    const incoming = nextMessage(socket);
    harness.broker.publish('s1', opened);

    expect(JSON.parse(await incoming)).toMatchObject({ type: 'task.opened' });
    socket.terminate();
  });

  it('does not leak one session into another session', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    let leaked = false;
    socket.on('message', () => {
      leaked = true;
    });
    harness.broker.publish('s2', opened);
    await new Promise((done) => setTimeout(done, 100));

    expect(leaked).toBe(false);
    socket.terminate();
  });

  it('routes a well-formed command to the slice that claimed it', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);

    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'hello' }));
    await waitUntil(() => harness.received.length === 1);

    expect(harness.received[0]).toEqual({ type: 'session.say', sessionId: 's1', text: 'hello' });
    socket.terminate();
  });

  it('drops a malformed frame instead of passing it on', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);

    socket.send('not json at all');
    socket.send(JSON.stringify({ type: 'task.delete', taskId: 't1' }));
    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'real' }));
    await waitUntil(() => harness.received.length > 0);

    expect(harness.received).toEqual([{ type: 'session.say', sessionId: 's1', text: 'real' }]);
    socket.terminate();
  });

  it('unsubscribes when the browser closes the tab', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    socket.close();

    // Gone, not merely inert: a leak here would leave a dead socket in the
    // broker for every tab a user has ever closed.
    await waitUntil(() => harness.broker.subscriberCount('s1') === 0);
  });

  it('unsubscribes when the connection drops without a handshake', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    socket.terminate();

    await waitUntil(() => harness.broker.subscriberCount('s1') === 0);
  });

  it('refuses a session this principal may not watch, and subscribes to nothing', async () => {
    const denied: SessionAccess = { canWatch: () => Promise.resolve(false) };
    const harness = await build(undefined, denied);
    const origin = await listen(harness);

    // 404 rather than 403: a 403 here would confirm the session exists, which
    // turns the status code into an oracle for guessing session ids.
    await expect(connect(`ws://${origin}/ws?session=s1`, AUTH)).rejects.toThrow(/404/);

    // Refused before the upgrade, so nothing was ever subscribed.
    expect(harness.broker.subscriberCount('s1')).toBe(0);
  });

  it('asks canWatch with the principal and the session it was given', async () => {
    const asked: Array<{ accountId: string; sessionId: string }> = [];
    const recording: SessionAccess = {
      canWatch: (principal, sessionId) => {
        asked.push({ accountId: principal.accountId, sessionId });
        return Promise.resolve(true);
      },
    };
    const harness = await build(undefined, recording);
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s7`, AUTH);

    expect(asked).toEqual([{ accountId: 'acc-1', sessionId: 's7' }]);
    socket.terminate();
  });

  it('drops a command that names a session this socket did not open', async () => {
    const harness = await build();
    const origin = await listen(harness);
    const socket = await connect(`ws://${origin}/ws?session=s1`, AUTH);

    // The client-supplied sessionId does not get to override the checked one.
    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's2', text: 'not mine' }));
    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'mine' }));
    await waitUntil(() => harness.received.length > 0);

    expect(harness.received).toEqual([{ type: 'session.say', sessionId: 's1', text: 'mine' }]);
    socket.terminate();
  });

  it('shuts down promptly with a browser still watching a session', async () => {
    const harness = await build();
    const origin = await listen(harness);
    await connect(`ws://${origin}/ws?session=s1`, AUTH);
    await waitUntil(() => harness.broker.subscriberCount('s1') === 1);

    // A WebSocket is never idle, so nothing releases it on its own. If close()
    // did not reach the open sockets, a single watching tab would hold the
    // process open until its orchestrator gave up and SIGKILLed it.
    app = null;
    const startedAt = Date.now();
    await harness.app.close();

    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});
