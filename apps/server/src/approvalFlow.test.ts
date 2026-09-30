import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '@lumen/contracts';
import { composeApp, type App } from './app.js';
import type { Db } from './core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from './core/db/testDb.js';
import type { Worker } from './core/domain/worker.js';
import type { Approval } from './modules/billing/index.js';
const origin = 'http://localhost:4000';

describe.skipIf(!TEST_DATABASE_URL)('composed durable approval flow', () => {
  let app: App;
  let db: Db;
  let drop: () => Promise<void>;
  let cookie: string;
  let accountId: string;
  const run = vi.fn<Worker['run']>();
  const compose = (): Promise<App> =>
    composeApp({
      db,
      identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
      worker: { run },
      logLevel: 'silent',
    });
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    run.mockReset().mockImplementation(async (task, _input, report) => {
      await report.addSpend(task.id, { dollars: 0.1 }, 'approved work');
    });
    app = await compose();
    const signed = await signup('owner@example.test');
    cookie = signed.cookie;
    accountId = signed.accountId;
  });
  afterEach(async () => {
    await app?.server.close();
    await app?.session.kernel.idle();
    await drop?.();
  });
  async function signup(email: string): Promise<{ cookie: string; accountId: string }> {
    const reply = await app.server.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Approval owner', password: 'correct horse battery 9' },
    });
    expect(reply.statusCode).toBe(201);
    return {
      cookie: reply.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
      accountId: reply.json<{ accountId: string }>().accountId,
    };
  }
  async function cap(dollars: number): Promise<void> {
    const reply = await app.server.inject({
      method: 'PATCH',
      url: '/api/wallet/cap',
      headers: { cookie, origin },
      payload: { cap: { dollars } },
    });
    expect(reply.statusCode).toBe(200);
  }
  async function snapshot(id: string): Promise<SessionSnapshot> {
    const reply = await app.server.inject({ url: `/api/sessions/${id}`, headers: { cookie } });
    expect(reply.statusCode).toBe(200);
    return reply.json<SessionSnapshot>();
  }
  async function ask(): Promise<SessionSnapshot> {
    const reply = await app.server.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie, origin },
      payload: { question: 'Budget approval test', mode: 'explore' },
    });
    expect(reply.statusCode).toBe(201);
    await app.session.kernel.idle();
    return snapshot(reply.json<{ sessionId: string }>().sessionId);
  }
  async function approvals(): Promise<Approval[]> {
    const reply = await app.server.inject({ url: '/api/wallet/approvals', headers: { cookie } });
    expect(reply.statusCode).toBe(200);
    return reply.json<{ approvals: Approval[] }>().approvals;
  }
  async function decide(id: string, action: 'grant' | 'reject'): Promise<void> {
    const reply = await app.server.inject({
      method: 'POST',
      url: `/api/wallet/approvals/${id}/${action}`,
      headers: { cookie, origin },
      payload: {},
    });
    expect(reply.statusCode).toBe(202);
  }
  it('persists waiting across restart, runs once after approval and never reuses it for a later turn', async () => {
    await cap(0);
    const waiting = await ask();
    expect(waiting.tasks[0]?.status).toBe('waiting');
    expect(run).not.toHaveBeenCalled();
    const [approval] = await approvals();
    expect(approval).toMatchObject({ status: 'pending', unknownCost: true });
    await app.server.close();
    app = await compose();
    expect((await snapshot(waiting.session.id)).tasks[0]?.status).toBe('waiting');
    await decide(approval!.id, 'grant');
    await expect
      .poll(async () => (await snapshot(waiting.session.id)).tasks[0]?.status, { timeout: 5000 })
      .toBe('ended');
    expect(run).toHaveBeenCalledTimes(1);
    await decide(approval!.id, 'grant');
    await expect(
      app.session.approvals.requestResume({ accountId, approvalId: approval!.id }),
    ).rejects.toMatchObject({ status: 404 });
    expect(run).toHaveBeenCalledTimes(1);
    expect((await snapshot(waiting.session.id)).spend).toEqual({ dollars: 0.1 });
    await app.session.kernel.say(waiting.session.id, { accountId, role: 'user' }, 'another turn');
    await app.session.kernel.idle();
    expect((await snapshot(waiting.session.id)).tasks[0]?.status).toBe('waiting');
    expect(run).toHaveBeenCalledTimes(1);
    const next = (await approvals()).find((row) => row.status === 'pending');
    expect(next?.attemptId).not.toBe(approval!.attemptId);
  });
  it('rejects without running even if the cap is raised before delivery', async () => {
    await cap(0);
    const waiting = await ask();
    const [approval] = await approvals();
    await decide(approval!.id, 'reject');
    await cap(10);
    await expect
      .poll(async () => (await snapshot(waiting.session.id)).tasks[0]?.status, { timeout: 5000 })
      .toBe('stopped');
    expect(run).not.toHaveBeenCalled();
  });
  it('resumes a fan-out and its children without replaying the parent charge', async () => {
    run.mockImplementation(async (task, _input, report) => {
      if (task.depth === 0) {
        await report.addSpend(task.id, { dollars: 1 }, 'parent charge');
        await report.delegate(task.id, [
          { agent: 'reader', title: 'First' },
          { agent: 'reader', title: 'Second' },
        ]);
      } else await report.addSpend(task.id, { dollars: 0.1 }, 'child charge');
    });
    const waiting = await ask();
    expect(waiting.tasks[0]?.status).toBe('waiting');
    const [approval] = await approvals();
    expect(approval?.checkpoint).toBe('fan-out');
    await decide(approval!.id, 'grant');
    await expect
      .poll(
        async () =>
          (await snapshot(waiting.session.id)).tasks.filter((task) => task.status === 'ended')
            .length,
        { timeout: 5000 },
      )
      .toBe(3);
    expect(run).toHaveBeenCalledTimes(3);
    const wallet = await app.server.inject({ url: '/api/wallet', headers: { cookie } });
    expect(wallet.json()).toEqual({ spent: { dollars: 1.2 }, cap: { dollars: 1 } });
    expect(await approvals()).toHaveLength(1);
  });
  it('does not restart a task stopped while its approval was pending', async () => {
    await cap(0);
    const waiting = await ask();
    const [approval] = await approvals();
    await app.session.kernel.stop(waiting.session.id, { accountId, role: 'user' });
    await decide(approval!.id, 'grant');
    await expect
      .poll(async () => (await approvals())[0]?.resumePending, { timeout: 5000 })
      .toBe(false);
    expect((await snapshot(waiting.session.id)).tasks[0]?.status).toBe('stopped');
    expect(run).not.toHaveBeenCalled();
  });

  it('isolates owners, validates origin and IDs, and rejects anonymous decisions', async () => {
    await cap(0);
    await ask();
    const [approval] = await approvals();
    const other = await signup('other@example.test');
    const path = `/api/wallet/approvals/${approval!.id}/grant`;
    expect((await app.server.inject('/api/wallet/approvals')).statusCode).toBe(401);
    expect(
      (await app.server.inject({ method: 'POST', url: path, headers: { origin }, payload: {} }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.server.inject({
          method: 'POST',
          url: path,
          headers: { cookie, origin: 'https://foreign.example' },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.server.inject({
          method: 'POST',
          url: path,
          headers: { cookie: other.cookie, origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.server.inject({
          method: 'POST',
          url: '/api/wallet/approvals/bad/grant',
          headers: { cookie, origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.server.inject({ url: '/api/wallet/approvals', headers: { cookie: other.cookie } })
      ).json(),
    ).toEqual({ approvals: [] });
    expect(run).not.toHaveBeenCalled();
  });
});
