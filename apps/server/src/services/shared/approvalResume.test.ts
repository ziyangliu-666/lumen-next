// Real HTTP between separately composed billing and session servers, backed by
// an isolated Postgres schema. The worker is deterministic; no RabbitMQ or model
// provider is required. Only public slice indexes cross module boundaries.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Worker } from '../../core/domain/worker.js';
import { buildServer } from '../../core/http/server.js';
import { Broker } from '../../core/protocol/broker.js';
import { createBillingSlice, type Approval } from '../../modules/billing/index.js';
import { createIdentitySlice, LoginGate } from '../../modules/identity/index.js';
import { createProjectsSlice } from '../../modules/projects/index.js';
import { createSessionSlice, type SessionSlice } from '../../modules/session/index.js';
import { registerApprovalResume, remoteApprovalResume } from './approvalResume.js';

const origin = 'http://localhost:4000';
const key = 'acceptance-only-internal-key';
const path = '/internal/approvals/resume';

describe.skipIf(!TEST_DATABASE_URL)('billing to session approval HTTP acceptance', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let billingServer: FastifyInstance;
  let sessionServer: FastifyInstance;
  let session: SessionSlice;
  let identity: ReturnType<typeof createIdentitySlice>;
  let sessionUrl: string;
  let billingUrl: string;
  let cookie: string;
  let accountId: string;
  let unavailable: boolean;
  let deliveryAttempts: number;
  const run = vi.fn<Worker['run']>();

  async function startBilling(): Promise<void> {
    const billing = createBillingSlice({
      db,
      origin,
      canSpend: identity.canSpend,
      approvalResume: remoteApprovalResume(sessionUrl, key),
    });
    billingServer = await buildServer({
      broker: new Broker(),
      resolver: identity.principalResolver,
      access: { canWatch: () => Promise.resolve(false) },
      logLevel: 'silent',
    });
    await billingServer.register(billing.registerRoutes);
    billingUrl = await billingServer.listen({ host: '127.0.0.1', port: 0 });
  }

  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    unavailable = false;
    deliveryAttempts = 0;
    run.mockReset().mockImplementation(async (task, _input, report) => {
      await report.addSpend(task.id, { dollars: 0.1 }, 'approved HTTP work');
    });
    identity = createIdentitySlice({
      database: db,
      origin,
      sessionLifetimeMs: 3600000,
      secureCookies: false,
      loginGate: new LoginGate(),
    });
    // Session needs a local guard and ledger, as in services/session.ts. Its
    // billing routes are deliberately not registered: only the remote service
    // can dispatch the decision in this fixture.
    const localBilling = createBillingSlice({
      db,
      canSpend: identity.canSpend,
      approvalResume: { requestResume: (input) => session.approvals.requestResume(input) },
    });
    const broker = new Broker();
    session = createSessionSlice({
      db,
      broker,
      worker: { run },
      budget: localBilling.budgetGuard,
      recordSpend: localBilling.record,
    });
    sessionServer = await buildServer({
      broker,
      resolver: identity.principalResolver,
      access: session.access,
      logLevel: 'silent',
    });
    // Public signup/project routes are setup conveniences for this isolated
    // fixture; production serves them in identity/project respectively.
    await sessionServer.register(identity.registerRoutes);
    await sessionServer.register(
      createProjectsSlice({ db, sessions: session.projects }).registerRoutes,
    );
    sessionServer.addHook('preHandler', async (request, reply) => {
      if (request.url === path) {
        deliveryAttempts++;
        if (unavailable) return reply.status(503).send({ message: 'temporary outage' });
      }
    });
    registerApprovalResume(sessionServer, session.approvals, key);
    sessionUrl = await sessionServer.listen({ host: '127.0.0.1', port: 0 });
    await startBilling();
    ({ cookie, accountId } = await signup('owner@example.test'));
    await cap(0);
  });

  afterEach(async () => {
    await billingServer?.close();
    await sessionServer?.close();
    await session?.kernel.idle();
    await drop?.();
  });

  async function signup(email: string): Promise<{ cookie: string; accountId: string }> {
    const response = await sessionServer.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin },
      payload: { email, displayName: 'Approval owner', password: 'correct horse battery 9' },
    });
    expect(response.statusCode).toBe(201);
    return {
      cookie: response.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
      accountId: response.json<{ accountId: string }>().accountId,
    };
  }

  async function cap(dollars: number): Promise<void> {
    const response = await fetch(`${billingUrl}/api/wallet/cap`, {
      method: 'PATCH',
      headers: { cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ cap: { dollars } }),
    });
    expect(response.status).toBe(200);
    await response.arrayBuffer();
  }
  async function ask(): Promise<string> {
    const response = await sessionServer.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie, origin },
      payload: { question: 'HTTP approval acceptance', mode: 'explore' },
    });
    expect(response.statusCode).toBe(201);
    await session.kernel.idle();
    const id = response.json<{ sessionId: string }>().sessionId;
    expect(await status(id)).toBe('waiting');
    expect(run).not.toHaveBeenCalled();
    return id;
  }
  async function status(id: string): Promise<string | undefined> {
    return (await session.kernel.snapshot(id, { accountId, role: 'user' })).tasks[0]?.status;
  }
  async function approvals(): Promise<Approval[]> {
    const response = await fetch(`${billingUrl}/api/wallet/approvals`, { headers: { cookie } });
    expect(response.status).toBe(200);
    return ((await response.json()) as { approvals: Approval[] }).approvals;
  }
  async function decide(
    id: string,
    action: 'grant' | 'reject',
    ownerCookie = cookie,
  ): Promise<number> {
    const response = await fetch(`${billingUrl}/api/wallet/approvals/${id}/${action}`, {
      method: 'POST',
      headers: { cookie: ownerCookie, origin, 'content-type': 'application/json' },
      body: '{}',
    });
    await response.arrayBuffer();
    return response.status;
  }

  it('blocks over-cap work, then grants exactly the waiting attempt across HTTP', async () => {
    const id = await ask();
    const [approval] = await approvals();
    expect(approval).toMatchObject({ status: 'pending', resumePending: false });
    expect(await decide(approval!.id, 'grant')).toBe(202);
    await expect.poll(() => status(id), { timeout: 5000 }).toBe('ended');
    await expect.poll(async () => (await approvals())[0]?.resumePending).toBe(false);
    expect(deliveryAttempts).toBeGreaterThan(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(await decide(approval!.id, 'grant')).toBe(202);
    await expect(
      remoteApprovalResume(sessionUrl, key).requestResume({ accountId, approvalId: approval!.id }),
    ).rejects.toMatchObject({ status: 404 });
    expect(run).toHaveBeenCalledTimes(1);
    const wallet = await fetch(`${billingUrl}/api/wallet`, { headers: { cookie } });
    expect(await wallet.json()).toEqual({ spent: { dollars: 0.1 }, cap: { dollars: 0 } });
    await session.kernel.say(id, { accountId, role: 'user' }, 'a separate turn');
    await session.kernel.idle();
    expect(await status(id)).toBe('waiting');
    expect(run).toHaveBeenCalledTimes(1);
    expect((await approvals()).find((row) => row.status === 'pending')?.attemptId).not.toBe(
      approval!.attemptId,
    );
  });

  it('delivers rejection without running, even when the cap subsequently increases', async () => {
    const id = await ask();
    const [approval] = await approvals();
    expect(await decide(approval!.id, 'reject')).toBe(202);
    await cap(10);
    await expect.poll(() => status(id), { timeout: 5000 }).toBe('stopped');
    await expect.poll(async () => (await approvals())[0]?.resumePending).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses an untrusted internal caller and a different account', async () => {
    const id = await ask();
    const [approval] = await approvals();
    const other = await signup('other@example.test');
    expect(await decide(approval!.id, 'grant', other.cookie)).toBe(404);
    await expect(
      remoteApprovalResume(sessionUrl, 'wrong').requestResume({
        accountId,
        approvalId: approval!.id,
      }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      remoteApprovalResume(sessionUrl, key).requestResume({
        accountId: other.accountId,
        approvalId: approval!.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await status(id)).toBe('waiting');
    expect((await approvals())[0]?.status).toBe('pending');
    expect(run).not.toHaveBeenCalled();
  });

  it('retains a failed HTTP delivery across billing restart and retries its durable lease', async () => {
    const id = await ask();
    const [approval] = await approvals();
    unavailable = true;
    expect(await decide(approval!.id, 'grant')).toBe(202);
    await expect.poll(() => deliveryAttempts, { timeout: 5000 }).toBeGreaterThan(0);
    await billingServer.close();
    expect((await session.kernel.snapshot(id, { accountId, role: 'user' })).tasks[0]?.status).toBe(
      'waiting',
    );
    expect(run).not.toHaveBeenCalled();
    unavailable = false;
    await startBilling();
    expect((await approvals())[0]).toMatchObject({ status: 'consumed', resumePending: true });
    // Use the real 30-second lease: no SQL backdoor or fake timer can conceal
    // a broken persistence/retry boundary.
    await expect.poll(() => status(id), { timeout: 35000, interval: 250 }).toBe('ended');
    await expect.poll(async () => (await approvals())[0]?.resumePending).toBe(false);
    expect(deliveryAttempts).toBeGreaterThanOrEqual(2);
    expect(run).toHaveBeenCalledTimes(1);
  }, 45000);
});
