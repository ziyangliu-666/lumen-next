import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { composeApp } from '../../app.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { createIdentitySlice, LoginGate } from '../identity/index.js';
import { createBillingSlice, type Charge } from './index.js';
import { Approvals } from './approvals.js';

const origin = 'http://localhost:4000';
const email = 'approval-lifecycle@example.test';
const password = 'correct horse battery 9';

describe.skipIf(!TEST_DATABASE_URL)('billing approval and identity lifecycle', () => {
  it.each(['suspend', 'delete'] as const)(
    'does not let a previously granted approval bypass account %s',
    async (action) => {
      const { db, drop } = await openTestDb();
      const app = await composeApp({
        db,
        identity: { origin, sessionLifetimeMs: 3600000, secureCookies: false },
        logLevel: 'silent',
      });
      const identity = createIdentitySlice({
        database: db,
        origin,
        sessionLifetimeMs: 3600000,
        secureCookies: false,
        loginGate: new LoginGate(),
      });
      // No delivery timer on this slice: exercise the guard with a durable
      // consumed decision independently of session scheduling.
      const resume = { requestResume: (): Promise<void> => Promise.resolve() };
      const billing = createBillingSlice({
        db,
        canSpend: identity.canSpend,
        approvalResume: resume,
      });
      const approvals = new Approvals(db, resume);
      try {
        const signup = async (): Promise<{ id: string; cookie: string }> => {
          const response = await app.server.inject({
            method: 'POST',
            url: '/api/auth/signup',
            headers: { origin },
            payload: { email, password, displayName: 'Approval lifecycle fixture' },
          });
          expect(response.statusCode).toBe(201);
          return {
            id: response.json<{ accountId: string }>().accountId,
            cookie: response.cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
          };
        };
        const owner = await signup();
        const charge: Charge = {
          accountId: owner.id,
          taskId: randomUUID(),
          attemptId: randomUUID(),
          at: 'turn',
          estimate: { dollars: 2 },
          reason: 'Lifecycle regression',
        };
        const decision = await billing.budgetGuard.check(charge);
        expect(decision.kind).toBe('escalate');
        if (decision.kind !== 'escalate') throw new Error('expected durable escalation');
        await approvals.decide(owner.id, decision.approvalId, 'grant');
        expect(await billing.budgetGuard.check(charge)).toEqual({ kind: 'allow' });

        if (action === 'suspend') await identity.suspend(owner.id, true);
        else {
          const removed = await app.server.inject({
            method: 'DELETE',
            url: '/api/me',
            headers: { origin, cookie: owner.cookie },
            payload: { currentPassword: password },
          });
          expect(removed.statusCode).toBe(204);
        }
        expect(await billing.budgetGuard.check(charge)).toEqual({
          kind: 'deny',
          reason: 'account cannot spend',
        });
        expect((await approvals.list(owner.id))[0]?.status).toBe('consumed');
        for (const operation of ['grant', 'reject']) {
          const response = await app.server.inject({
            method: 'POST',
            url: `/api/wallet/approvals/${decision.approvalId}/${operation}`,
            headers: { origin, cookie: owner.cookie },
            payload: {},
          });
          expect(response.statusCode).toBe(401);
        }

        if (action === 'suspend') {
          await identity.suspend(owner.id, false);
          // Restoration does not resurrect the revoked browser session.
          expect(
            (
              await app.server.inject({
                url: '/api/wallet/approvals',
                headers: { cookie: owner.cookie },
              })
            ).statusCode,
          ).toBe(401);
          const login = await app.server.inject({
            method: 'POST',
            url: '/api/auth/password',
            headers: { origin },
            payload: { email, password },
          });
          expect(login.statusCode).toBe(200);
          const cookie = login.cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
          expect(
            (await app.server.inject({ url: '/api/wallet/approvals', headers: { cookie } }))
              .statusCode,
          ).toBe(200);
          expect(await billing.budgetGuard.check(charge)).toEqual({ kind: 'allow' });
          expect(
            (await billing.budgetGuard.check({ ...charge, attemptId: randomUUID() })).kind,
          ).toBe('escalate');
        } else {
          const replacement = await signup();
          expect(replacement.id).not.toBe(owner.id);
          expect(await approvals.list(replacement.id)).toEqual([]);
          expect(
            (await billing.budgetGuard.check({ ...charge, accountId: replacement.id })).kind,
          ).toBe('escalate');
          expect((await billing.budgetGuard.check(charge)).kind).toBe('deny');
        }
      } finally {
        await app.server.close();
        await app.session.kernel.idle();
        await drop();
      }
    },
  );
});
