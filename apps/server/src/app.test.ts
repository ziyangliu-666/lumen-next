import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '@lumen/contracts';
import { composeApp, type App } from './app.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';
import type { Worker } from './core/domain/worker.js';

const ORIGIN = 'http://localhost:4000';

describe.skipIf(!TEST_DATABASE_URL)('composed application budget enforcement', () => {
  let app: App;
  let drop: () => Promise<void>;
  let cookie: string;
  const run = vi.fn<Worker['run']>();

  beforeEach(async () => {
    const fixture = await openTestDb();
    drop = fixture.drop;
    run.mockReset();
    run.mockImplementation(async (task, _input, report) => {
      await report.addSpend(task.id, { dollars: 0.1 }, 'test work');
    });
    app = await composeApp({
      db: fixture.db,
      identity: { origin: ORIGIN, sessionLifetimeMs: 3_600_000, secureCookies: false },
      worker: { run },
      logLevel: 'silent',
    });
    const signup = await app.server.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin: ORIGIN },
      payload: {
        email: 'budget@example.com',
        password: 'correct horse battery 9',
        displayName: 'Budget account',
      },
    });
    expect(signup.statusCode).toBe(201);
    cookie = signup.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
    expect(cookie).not.toBe('');
  });

  afterEach(async () => {
    await app?.session.kernel.idle();
    await app?.server.close();
    await drop?.();
  });

  async function setCap(dollars: number): Promise<void> {
    const response = await app.server.inject({
      method: 'PATCH',
      url: '/api/wallet/cap',
      headers: { cookie, origin: ORIGIN },
      payload: { cap: { dollars } },
    });
    expect(response.statusCode).toBe(200);
  }

  async function ask(): Promise<SessionSnapshot> {
    const response = await app.server.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie, origin: ORIGIN },
      payload: { question: 'Run budgeted work', mode: 'explore' },
    });
    expect(response.statusCode).toBe(201);
    const { sessionId } = response.json<{ sessionId: string }>();
    await app.session.kernel.idle();
    const snapshot = await app.server.inject({
      url: `/api/sessions/${sessionId}`,
      headers: { cookie },
    });
    expect(snapshot.statusCode).toBe(200);
    return snapshot.json<SessionSnapshot>();
  }

  async function wallet(): Promise<unknown> {
    const response = await app.server.inject({ url: '/api/wallet', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    return response.json<unknown>();
  }

  it('lets a new account run below its default cap and records the charge', async () => {
    expect(await wallet()).toEqual({ spent: { dollars: 0 }, cap: { dollars: 1 } });
    const snapshot = await ask();
    expect(run).toHaveBeenCalledTimes(1);
    expect(snapshot.tasks.map((task) => task.status)).toEqual(['ended']);
    expect(snapshot.spend).toEqual({ dollars: 0.1 });
    expect(await wallet()).toEqual({ spent: { dollars: 0.1 }, cap: { dollars: 1 } });
  });

  it('stops the next turn before work when recorded spend exceeds the saved cap', async () => {
    await ask();
    await setCap(0.05);
    const refused = await ask();
    expect(run).toHaveBeenCalledTimes(1);
    expect(refused.tasks.map((task) => task.status)).toEqual(['waiting']);
    expect(refused.steps.some((step) => step.text.includes('approval'))).toBe(true);
    expect(refused.spend).toEqual({ dollars: 0 });
    expect(await wallet()).toEqual({ spent: { dollars: 0.1 }, cap: { dollars: 0.05 } });
  });

  it('refuses unknown-cost work at an explicitly saved zero cap', async () => {
    await setCap(0);
    const refused = await ask();
    expect(run).not.toHaveBeenCalled();
    expect(refused.tasks.map((task) => task.status)).toEqual(['waiting']);
    expect(refused.steps.some((step) => step.text.includes('approval'))).toBe(true);
    expect(await wallet()).toEqual({ spent: { dollars: 0 }, cap: { dollars: 0 } });
  });

  it('stops fan-out when the parent has used the remaining room', async () => {
    let refusal: unknown;
    run.mockImplementation(async (task, _input, report) => {
      await report.addSpend(task.id, { dollars: 1 }, 'use remaining room');
      try {
        await report.delegate(task.id, [{ agent: 'reader', title: 'Must not start' }]);
      } catch (error) {
        refusal = error;
        throw error;
      }
    });
    const refused = await ask();
    expect(run).toHaveBeenCalledTimes(1);
    // Escalation preserves the blocked fan-out without opening any child.
    expect(refused.tasks.map((task) => task.status)).toEqual(['waiting']);
    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as Error).message).toContain('approval');
    expect(await wallet()).toEqual({ spent: { dollars: 1 }, cap: { dollars: 1 } });
  });
});

it('runs development stub sessions in database-free memory mode', async () => {
  const run = vi.fn<Worker['run']>().mockResolvedValue(undefined);
  const app = await composeApp({ db: null, identity: null, worker: { run }, logLevel: 'silent' });
  try {
    const headers = { authorization: 'stub development:user' };
    const created = await app.server.inject({
      method: 'POST',
      url: '/api/projects',
      headers,
      payload: { question: 'Develop a page without a database', mode: 'explore' },
    });
    expect(created.statusCode).toBe(201);
    await app.session.kernel.idle();
    const snapshot = await app.server.inject({
      url: `/api/sessions/${created.json<{ sessionId: string }>().sessionId}`,
      headers,
    });
    expect(snapshot.statusCode).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(snapshot.json<SessionSnapshot>().tasks.map((task) => task.status)).toEqual(['ended']);
  } finally {
    await app.session.kernel.idle();
    await app.server.close();
  }
});
