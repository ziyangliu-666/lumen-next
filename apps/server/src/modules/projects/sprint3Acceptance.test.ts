import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { composeApp, type App } from '../../app.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Db } from '../../core/db/db.js';
import type { Worker } from '../../core/domain/worker.js';
import type { Approval } from '../billing/index.js';
import type { Page, ProjectCard } from './models.js';

const origin = 'http://localhost:4000';
const password = 'correct horse battery 9';

describe.skipIf(!TEST_DATABASE_URL)('projects Sprint 3 composed acceptance', () => {
  let app: App;
  let db: Db;
  let drop: () => Promise<void>;
  let cookie: string;
  const worker: Worker = {
    async run(task, _input, report) {
      await report.addSpend(task.id, { dollars: 0.1 }, 'acceptance work');
      await report.recordFinding(task.id, 'Acceptance finding');
    },
  };
  const start = (): Promise<App> =>
    composeApp({
      db,
      identity: { origin, sessionLifetimeMs: 3_600_000, secureCookies: false },
      worker,
      logLevel: 'silent',
    });

  async function signup(email: string): Promise<string> {
    const response = await app.server.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, password, displayName: 'Acceptance owner' },
    });
    expect(response.statusCode).toBe(201);
    return response.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
  }
  async function create(): Promise<{ project: { id: string }; sessionId: string }> {
    const response = await app.server.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie, origin },
      payload: { question: 'Acceptance question', mode: 'explore' },
    });
    expect(response.statusCode).toBe(201);
    await app.session.kernel.idle();
    return response.json();
  }
  async function cards(): Promise<readonly ProjectCard[]> {
    const response = await app.server.inject({ url: '/api/projects', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    return response.json<Page<ProjectCard>>().items;
  }
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    app = await start();
    cookie = await signup('owner@example.com');
  });
  afterEach(async () => {
    await app?.session.kernel.idle();
    await app?.server.close();
    await drop?.();
  });

  it('reads the owner card and findings through HTTP after recomposing over the same database', async () => {
    const created = await create();
    const before = await cards();
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({
      project: { id: created.project.id },
      label: 'Finished',
      findingsCount: 1,
      latestSession: { spend: { dollars: 0.1 }, status: 'ended' },
    });
    const opened = await app.server.inject({
      url: `/api/sessions/${created.sessionId}`,
      headers: { cookie },
    });
    expect(opened.statusCode).toBe(200);
    await app.server.close();
    app = await start();
    expect(await cards()).toEqual(before);
    const findings = await app.server.inject({
      url: `/api/projects/${created.project.id}/findings`,
      headers: { cookie },
    });
    expect(findings.statusCode).toBe(200);
    expect(findings.json<{ items: { text: string }[] }>().items.map((f) => f.text)).toEqual([
      'Acceptance finding',
    ]);
  });
  it('clears activity with a durable visit and counts later work after restart', async () => {
    const created = await create();
    expect((await cards())[0]).toMatchObject({
      lastOpenedAt: null,
      sinceLastVisit: { sessionsEnded: 1, findingsAdded: 1, spend: { dollars: 0.1 } },
    });
    const response = await app.server.inject({
      method: 'POST',
      url: `/api/projects/${created.project.id}/visit`,
      headers: { cookie, origin },
    });
    expect(response.statusCode).toBe(200);
    const { lastOpenedAt } = response.json<{ lastOpenedAt: number }>();
    const cleared = {
      lastOpenedAt,
      sinceLastVisit: { sessionsEnded: 0, findingsAdded: 0, spend: { dollars: 0 } },
    };
    expect((await cards())[0]).toMatchObject(cleared);
    await app.server.close();
    app = await start();
    expect((await cards())[0]).toMatchObject(cleared);
    const principal = (await app.server.inject({ url: '/api/me', headers: { cookie } })).json<{
      id: string;
    }>();
    await app.session.kernel.say(
      created.sessionId,
      { accountId: principal.id, role: 'user' },
      'More research',
    );
    await app.session.kernel.idle();
    expect((await cards())[0]).toMatchObject({
      lastOpenedAt,
      sinceLastVisit: { sessionsEnded: 1, findingsAdded: 1, spend: { dollars: 0.1 } },
    });
  });

  it('keeps retained records inaccessible to another account and a re-registered email', async () => {
    const created = await create();
    const originalCookie = cookie;
    cookie = await signup('other@example.com');
    expect(await cards()).toEqual([]);
    for (const suffix of ['', '/findings']) {
      expect(
        (
          await app.server.inject({
            url: `/api/projects/${created.project.id}${suffix}`,
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(404);
    }
    const deletion = await app.server.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: { cookie: originalCookie, origin },
      payload: { currentPassword: password },
    });
    expect(deletion.statusCode).toBe(204);
    expect(
      (await app.server.inject({ url: '/api/projects', headers: { cookie: originalCookie } }))
        .statusCode,
    ).toBe(401);
    cookie = await signup('owner@example.com');
    expect(await cards()).toEqual([]);
    for (const suffix of ['', '/findings']) {
      expect(
        (
          await app.server.inject({
            url: `/api/projects/${created.project.id}${suffix}`,
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(404);
    }
    expect(
      await db.query('select id from projects where id = $1', [created.project.id]),
    ).toHaveLength(1);
    expect(
      await db.query('select id from findings where project_id = $1', [created.project.id]),
    ).toHaveLength(1);
  });

  it('keeps a cap wait across restart and shows the resumed turn exactly once after a grant', async () => {
    const created = await create();
    const setCap = async (dollars: number): Promise<void> => {
      const response = await app.server.inject({
        method: 'PATCH',
        url: '/api/wallet/cap',
        headers: { cookie, origin },
        payload: { cap: { dollars } },
      });
      expect(response.statusCode).toBe(200);
    };
    const principal = (await app.server.inject({ url: '/api/me', headers: { cookie } })).json<{
      id: string;
    }>();
    await setCap(0);
    await app.session.kernel.say(
      created.sessionId,
      { accountId: principal.id, role: 'user' },
      'Continue',
    );
    await app.session.kernel.idle();
    expect((await cards())[0]).toMatchObject({
      label: 'Waiting for you',
      findingsCount: 1,
      latestSession: { id: created.sessionId, status: 'waiting', spend: { dollars: 0.1 } },
    });
    const approvals = await app.server.inject({
      url: '/api/wallet/approvals',
      headers: { cookie },
    });
    expect(approvals.statusCode).toBe(200);
    const [approval] = approvals.json<{ approvals: Approval[] }>().approvals;
    expect(approval).toMatchObject({ status: 'pending' });
    const beforeRestart = await cards();
    await app.server.close();
    app = await start();
    await app.session.kernel.idle();
    expect(await cards()).toEqual(beforeRestart);
    const grant = () =>
      app.server.inject({
        method: 'POST',
        url: `/api/wallet/approvals/${approval!.id}/grant`,
        headers: { cookie, origin },
        payload: {},
      });
    expect((await grant()).statusCode).toBe(202);
    await expect
      .poll(async () => (await cards())[0]?.latestSession?.status, { timeout: 5000 })
      .toBe('ended');
    await app.session.kernel.idle();
    expect((await cards())[0]).toMatchObject({
      label: 'Finished',
      findingsCount: 2,
      latestSession: { id: created.sessionId, spend: { dollars: 0.2 } },
    });
    const findings = await app.server.inject({
      url: `/api/projects/${created.project.id}/findings`,
      headers: { cookie },
    });
    expect(findings.statusCode).toBe(200);
    expect(findings.json<{ items: { text: string }[] }>().items.map((item) => item.text)).toEqual([
      'Acceptance finding',
      'Acceptance finding',
    ]);
    expect((await grant()).statusCode).toBe(202);
    await app.session.kernel.idle();
    expect((await cards())[0]).toMatchObject({
      findingsCount: 2,
      latestSession: { spend: { dollars: 0.2 } },
    });
    const finished = await cards();
    await app.server.close();
    app = await start();
    expect(await cards()).toEqual(finished);
  });
});
