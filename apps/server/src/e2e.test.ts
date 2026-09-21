import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ClientCommand, ServerEvent, SessionSnapshot } from '@lumen/contracts';
import { composeApp, type App } from './app.js';
import type { Db } from './core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';

// End to end: the whole application, composed exactly as production composes
// it (app.ts), on a real Postgres with every migration applied, driven only
// through what a browser has: HTTP, a cookie, and one WebSocket.
//
// A slice's own tests prove the slice. This proves the joins between them:
// identity's cookie is what projects authorises with, projects' gate is what
// session asks before it opens anything, session's spend is what billing's
// wallet shows, and the event stream carries all of it to the page. It is the
// test that fails when two pull requests that were each green do not fit.

const ORIGIN = 'http://localhost:4000';
const JSON_HEADERS = { 'content-type': 'application/json', origin: ORIGIN };

interface Reply<T> {
  readonly status: number;
  readonly body: T;
  readonly cookie: string | null;
}

describe.skipIf(!TEST_DATABASE_URL)('end to end: sign up, ask, watch, pay', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let app: App;
  let host: string;

  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
    app = await composeApp({
      db,
      identity: { origin: ORIGIN, sessionLifetimeMs: 3_600_000, secureCookies: false },
      logLevel: 'silent',
    });
    // A real port: the event stream is a socket, and an injected transport
    // does not reproduce an upgrade faithfully (see core/http/server.test.ts).
    await app.server.listen({ port: 0, host: '127.0.0.1' });
    host = `127.0.0.1:${(app.server.server.address() as AddressInfo).port}`;
  }, 30_000);

  afterAll(async () => {
    await app?.session.kernel.idle();
    await app?.server.close();
    await drop?.();
  });

  async function call<T>(
    method: string,
    path: string,
    options: { cookie?: string | null; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Reply<T>> {
    const response = await fetch(`http://${host}${path}`, {
      method,
      headers: {
        ...(options.body === undefined ? { origin: ORIGIN } : JSON_HEADERS),
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const text = await response.text();
    const set = response.headers.get('set-cookie');
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : null) as T,
      // Only the name=value pair goes back in a Cookie header.
      cookie: set ? (set.split(';')[0] ?? null) : null,
    };
  }

  async function signUp(email: string): Promise<string> {
    const reply = await call('POST', '/api/auth/signup', {
      body: { email, password: 'correct horse battery 9', displayName: email.split('@')[0] },
    });
    expect(reply.status, `sign up ${email}`).toBe(201);
    expect(reply.cookie, 'sign up sets the session cookie').toBeTruthy();
    return reply.cookie!;
  }

  /**
   * Everything the socket receives until `done` says stop, or 5 s pass. `then`
   * is sent once the snapshot has arrived, which is the only moment the socket
   * is known to be subscribed: sent any earlier, the events it causes could be
   * published before anybody is listening.
   */
  function watch(
    cookie: string,
    sessionId: string,
    done: (events: ServerEvent[]) => boolean,
    then?: ClientCommand,
  ): Promise<ServerEvent[]> {
    return new Promise((resolve, reject) => {
      const events: ServerEvent[] = [];
      const socket = new WebSocket(`ws://${host}/ws`, { headers: { cookie } });
      const timer = setTimeout(() => {
        socket.terminate();
        reject(
          new Error(`socket: not done after 5 s, got ${events.map((e) => e.type).join(', ')}`),
        );
      }, 5_000);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'session.open', sessionId })));
      socket.on('message', (data: Buffer) => {
        const event = JSON.parse(data.toString('utf8')) as ServerEvent;
        events.push(event);
        if (then && events.length === 1 && event.type === 'session.snapshot') {
          socket.send(JSON.stringify(then));
        }
        if (done(events)) {
          clearTimeout(timer);
          socket.close();
          resolve(events);
        }
      });
      socket.on('error', reject);
    });
  }

  let alice: string;
  let projectId: string;
  let sessionId: string;

  it('refuses the development stub once real sign-in is on', async () => {
    const asStub = await call('GET', '/api/wallet', {
      headers: { authorization: 'stub alice:staff' },
    });
    const byCookie = await call('GET', '/api/wallet', { cookie: 'lumen_stub=stub alice:staff' });

    expect(asStub.status).toBe(401);
    expect(byCookie.status).toBe(401);
  });

  it('signs a visitor up, and the cookie alone says who they are', async () => {
    alice = await signUp('alice@example.com');

    const me = await call<{ email: string; role: string }>('GET', '/api/me', { cookie: alice });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'alice@example.com', role: 'user' });
    expect((await call('GET', '/api/me')).status).toBe(401);
  });

  it('starts a project from a question, and the session under it runs to the end', async () => {
    const created = await call<{ project: { id: string }; sessionId: string }>(
      'POST',
      '/api/projects',
      { cookie: alice, body: { question: 'what is new in fusion', mode: 'explore' } },
    );
    expect(created.status).toBe(201);
    ({ sessionId } = created.body);
    projectId = created.body.project.id;
    await app.session.kernel.idle();

    const snapshot = await call<SessionSnapshot>('GET', `/api/sessions/${sessionId}`, {
      cookie: alice,
    });
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.session).toMatchObject({ projectId, mode: 'explore' });
    // The lead and the three readers it delegated to.
    expect(snapshot.body.tasks.map((task) => [task.depth, task.status])).toEqual([
      [0, 'ended'],
      [1, 'ended'],
      [1, 'ended'],
      [1, 'ended'],
    ]);
    expect(snapshot.body.spend.dollars).toBeCloseTo(0.03, 6);

    // What each step carried went through Postgres as JSON and came back whole.
    const lead = snapshot.body.tasks[0]!;
    const delegate = snapshot.body.steps.find((step) => step.kind === 'delegate');
    expect(delegate?.detail?.childTaskIds).toEqual(
      snapshot.body.tasks.filter((task) => task.parentId === lead.id).map((task) => task.id),
    );
    const search = snapshot.body.steps.find((step) => step.detail?.cost !== undefined);
    expect(search?.detail).toMatchObject({ tool: 'search', cost: { dollars: 0.01 } });
    expect(search?.detail?.rows?.some((row) => row.empty)).toBe(true);
    const run = snapshot.body.steps.find((step) => step.detail?.tool === 'run');
    expect(run?.detail?.output?.split('\n')).toHaveLength(3);
  });

  it('shows the project card with the status, the spend and the findings of that session', async () => {
    const list = await call<{
      items: {
        project: { id: string };
        label: string;
        findingsCount: number;
        latestSession: { spend: { dollars: number } };
      }[];
    }>('GET', '/api/projects', { cookie: alice });

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      project: { id: projectId },
      label: 'Finished',
      findingsCount: 3,
    });
    expect(list.body.items[0]?.latestSession.spend.dollars).toBeCloseTo(0.03, 6);

    const findings = await call<{ items: unknown[] }>(
      'GET',
      `/api/projects/${projectId}/findings`,
      { cookie: alice },
    );
    expect(findings.body.items).toHaveLength(3);
  });

  it('charges what the session spent to the wallet of the account that asked', async () => {
    const wallet = await call<{ spent: { dollars: number } }>('GET', '/api/wallet', {
      cookie: alice,
    });
    const ledger = await call<{ entries: { reason: string; taskId: string }[] }>(
      'GET',
      '/api/wallet/ledger',
      { cookie: alice },
    );

    expect(wallet.body.spent.dollars).toBe(0.03);
    expect(ledger.body.entries).toHaveLength(3);
    expect(new Set(ledger.body.entries.map((entry) => entry.reason))).toEqual(new Set(['search']));
  });

  it('opens the session on the socket, is sent the snapshot, then sees a new turn arrive live', async () => {
    const opened = await watch(alice, sessionId, (events) => events.length >= 1);
    const first = opened[0];
    expect(first?.type).toBe('session.snapshot');
    expect(first?.type === 'session.snapshot' && first.snapshot.tasks).toHaveLength(4);

    // A second turn, said on the socket that is watching.
    const events = await watch(
      alice,
      sessionId,
      // lead running, reader running, reader ended, lead ended.
      (seen) => seen.filter((event) => event.type === 'task.status').length >= 4,
      { type: 'session.say', sessionId, text: 'and in 2026?' },
    );
    await app.session.kernel.idle();

    const types = events.map((event) => event.type);
    expect(types).toContain('step.appended');
    expect(types).toContain('task.opened');
    expect(types).toContain('task.cost');
    expect(types).toContain('finding.recorded');
    const said = events.find((event) => event.type === 'step.appended' && event.kind === 'you');
    expect(said).toMatchObject({ text: 'and in 2026?' });
    // One more reader ran, so one more cent.
    const wallet = await call<{ spent: { dollars: number } }>('GET', '/api/wallet', {
      cookie: alice,
    });
    expect(wallet.body.spent.dollars).toBe(0.04);
  });

  it('shows a second account nothing of the first: not the project, the session, the stream or the money', async () => {
    const bob = await signUp('bob@example.com');

    expect((await call('GET', `/api/projects/${projectId}`, { cookie: bob })).status).toBe(404);
    expect((await call('GET', `/api/sessions/${sessionId}`, { cookie: bob })).status).toBe(404);
    expect(
      (
        await call('POST', `/api/projects/${projectId}/sessions`, {
          cookie: bob,
          body: { text: 'let me in' },
        })
      ).status,
    ).toBe(404);
    expect((await call('POST', `/api/sessions/${sessionId}/stop`, { cookie: bob })).status).toBe(
      404,
    );
    expect(
      (await call<{ items: unknown[] }>('GET', '/api/projects', { cookie: bob })).body.items,
    ).toEqual([]);
    expect(
      (await call<{ spent: { dollars: number } }>('GET', '/api/wallet', { cookie: bob })).body.spent
        .dollars,
    ).toBe(0);

    const refused = await watch(bob, sessionId, (events) => events.length >= 1);
    expect(refused).toEqual([{ type: 'error', message: 'no such session' }]);
  });

  it('refuses a socket with no cookie before it is ever upgraded', async () => {
    const attempt = new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${host}/ws`);
      socket.once('open', () => resolve('opened'));
      socket.once('error', reject);
    });
    await expect(attempt).rejects.toThrow(/401/);
  });

  it('signs out, and the same cookie is worth nothing afterwards', async () => {
    expect((await call('POST', '/api/auth/signout', { cookie: alice })).status).toBe(204);

    expect((await call('GET', '/api/me', { cookie: alice })).status).toBe(401);
    expect((await call('GET', '/api/projects', { cookie: alice })).status).toBe(401);
  });

  it('kept all of it: a process that starts over the same database reads the same record', async () => {
    const again = await composeApp({
      db,
      identity: { origin: ORIGIN, sessionLifetimeMs: 3_600_000, secureCookies: false },
      logLevel: 'silent',
    });
    try {
      const login = await again.server.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: JSON_HEADERS,
        payload: { email: 'alice@example.com', password: 'correct horse battery 9' },
      });
      expect(login.statusCode).toBe(200);
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;

      const wallet = await again.server.inject({ url: '/api/wallet', headers: { cookie } });
      const snapshot = await again.server.inject({
        url: `/api/sessions/${sessionId}`,
        headers: { cookie },
      });
      expect(wallet.json<{ spent: { dollars: number } }>().spent.dollars).toBe(0.04);
      expect(snapshot.json<SessionSnapshot>().tasks).toHaveLength(5);
      // Nothing was left running, so the restart had nothing to stop.
      expect(again.orphans).toBe(0);
    } finally {
      await again.server.close();
    }
  });
});
