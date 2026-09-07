import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClientCommand, ServerEvent } from '@lumen/contracts';
import { makeTask } from '../domain/task.js';
import { Broker } from '../protocol/broker.js';
import { headerStub } from './authGuard.js';
import { Router } from './router.js';
import { buildServer } from './server.js';

// The whole transport in one process, on a real ephemeral port. The event stream
// is exercised over a real socket rather than an in-memory duplex, because the
// behaviour that matters most here — whether a disconnect unsubscribes — is not
// reproduced faithfully by an injected transport.

const opened: ServerEvent = {
  type: 'task.opened',
  task: makeTask('t1', 's1', null, 'lead', '', 0),
};

let server: Server | null = null;

afterEach(async () => {
  const running = server;
  server = null;
  if (running) await new Promise<void>((done) => running.close(() => done()));
});

interface Harness {
  readonly broker: Broker;
  readonly received: ClientCommand[];
  readonly origin: string;
  readonly wsUrl: (session: string) => string;
}

function start(webRoot?: string): Promise<Harness> {
  const broker = new Broker();
  const received: ClientCommand[] = [];
  broker.onCommand('session.say', (command) => {
    received.push(command);
  });

  const router = new Router(headerStub);
  router.get('/api/health', () => ({ status: 'ok' }));

  const built = buildServer({
    router,
    broker,
    resolver: headerStub,
    ...(webRoot === undefined ? {} : { webRoot }),
  });
  server = built;

  return new Promise((done) => {
    built.listen(0, '127.0.0.1', () => {
      const { port } = built.address() as AddressInfo;
      done({
        broker,
        received,
        origin: `http://127.0.0.1:${port}`,
        wsUrl: (session) => `ws://127.0.0.1:${port}/ws?session=${session}`,
      });
    });
  });
}

const AUTH = { headers: { authorization: 'stub acc-1:user' } };

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

describe('core: the HTTP server', () => {
  it('serves a route registered on the router', async () => {
    const { origin } = await start();
    const response = await fetch(`${origin}/api/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers 404 as JSON for an unknown api path', async () => {
    const { origin } = await start();
    const response = await fetch(`${origin}/api/nope`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no such route' });
  });

  it('serves the built web app when there is one', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lumen-web-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>lumen</title>');
    const { origin } = await start(root);

    const page = await fetch(`${origin}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('lumen');
  });

  it('refuses to serve a file outside the web root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lumen-web-'));
    writeFileSync(join(root, 'index.html'), 'ok');
    const { origin } = await start(root);

    // The client sends the traversal raw; fetch would otherwise normalise it away.
    const escaped = await fetch(`${origin}/..%2f..%2fpackage.json`);
    expect([403, 404]).toContain(escaped.status);
  });
});

describe('core: the event stream', () => {
  it('refuses an upgrade without a principal', async () => {
    const { wsUrl } = await start();
    await expect(connect(wsUrl('s1'))).rejects.toThrow(/401/);
  });

  it('refuses an upgrade that names no session', async () => {
    const { origin } = await start();
    const url = `${origin.replace('http', 'ws')}/ws`;
    await expect(connect(url, AUTH.headers)).rejects.toThrow(/400/);
  });

  it('delivers an event published to the session the socket watches', async () => {
    const { broker, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);
    await waitUntil(() => broker.subscriberCount('s1') === 1);

    const incoming = nextMessage(socket);
    broker.publish('s1', opened);

    expect(JSON.parse(await incoming)).toMatchObject({ type: 'task.opened' });
    socket.terminate();
  });

  it('does not leak one session into another session', async () => {
    const { broker, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);
    await waitUntil(() => broker.subscriberCount('s1') === 1);

    let leaked = false;
    socket.on('message', () => {
      leaked = true;
    });
    broker.publish('s2', opened);
    await new Promise((done) => setTimeout(done, 100));

    expect(leaked).toBe(false);
    socket.terminate();
  });

  it('routes a well-formed command to the slice that claimed it', async () => {
    const { received, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);

    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'hello' }));
    await waitUntil(() => received.length === 1);

    expect(received[0]).toEqual({ type: 'session.say', sessionId: 's1', text: 'hello' });
    socket.terminate();
  });

  it('drops a malformed frame instead of passing it on', async () => {
    const { received, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);

    socket.send('not json at all');
    socket.send(JSON.stringify({ type: 'task.delete', taskId: 't1' }));
    socket.send(JSON.stringify({ type: 'session.say', sessionId: 's1', text: 'real' }));
    await waitUntil(() => received.length > 0);

    expect(received).toEqual([{ type: 'session.say', sessionId: 's1', text: 'real' }]);
    socket.terminate();
  });

  it('unsubscribes when the browser closes the tab', async () => {
    const { broker, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);
    await waitUntil(() => broker.subscriberCount('s1') === 1);

    socket.close();

    // Gone, not merely inert: a leak here would leave a dead socket in the
    // broker for every tab a user has ever closed.
    await waitUntil(() => broker.subscriberCount('s1') === 0);
  });

  it('unsubscribes when the connection drops without a handshake', async () => {
    const { broker, wsUrl } = await start();
    const socket = await connect(wsUrl('s1'), AUTH.headers);
    await waitUntil(() => broker.subscriberCount('s1') === 1);

    socket.terminate();

    await waitUntil(() => broker.subscriberCount('s1') === 0);
  });
});
