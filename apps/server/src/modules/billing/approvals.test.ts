import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { Charge } from '../../core/domain/budget.js';
import { HttpError } from '../../core/http/httpError.js';
import { Approvals } from './approvals.js';

describe.skipIf(!TEST_DATABASE_URL)('billing durable approvals', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let store: Approvals;
  let charge: Charge;
  const resume = {
    requestResume: vi.fn<(_: { accountId: string; approvalId: string }) => Promise<void>>(),
  };
  beforeEach(async () => {
    ({ db, drop } = await openTestDb());
    resume.requestResume.mockReset().mockResolvedValue(undefined);
    store = new Approvals(db, resume);
    charge = {
      accountId: 'alice',
      taskId: randomUUID(),
      attemptId: randomUUID(),
      at: 'turn',
      estimate: { dollars: 0 },
      reason: 'run a turn',
    };
  });
  afterEach(async () => {
    await drop?.();
  });
  async function request(): Promise<string> {
    const decision = await store.request(charge);
    expect(decision.kind).toBe('escalate');
    if (decision.kind !== 'escalate') throw new Error('expected approval');
    return decision.approvalId;
  }
  it('deduplicates requests durably and binds them to the operation', async () => {
    const id = await request();
    expect(await new Approvals(db, resume).request(charge)).toEqual({
      kind: 'escalate',
      approvalId: id,
    });
    expect(await store.list('bob')).toEqual([]);
    expect(await store.check({ ...charge, taskId: randomUUID() })).toMatchObject({ kind: 'deny' });
    expect(await store.check({ ...charge, estimate: { dollars: 0.1 } })).toMatchObject({
      kind: 'deny',
    });
    expect(await store.check({ ...charge, attemptId: randomUUID() })).toBeNull();
  });
  it('grants once under concurrent clicks and delivers through a leased outbox', async () => {
    const id = await request();
    await Promise.all([store.decide('alice', id, 'grant'), store.decide('alice', id, 'grant')]);
    expect(await store.check(charge)).toEqual({ kind: 'allow' });
    await Promise.all([store.deliver(), new Approvals(db, resume).deliver()]);
    expect(resume.requestResume).toHaveBeenCalledTimes(1);
    expect(resume.requestResume).toHaveBeenCalledWith({ accountId: 'alice', approvalId: id });
    await store.decide('alice', id, 'grant');
    await store.deliver();
    expect(resume.requestResume).toHaveBeenCalledTimes(1);
    await expect(store.decide('alice', id, 'reject')).rejects.toMatchObject({ status: 409 });
  });
  it('retries durable delivery after failure and treats core 404 as final', async () => {
    const id = await request();
    await store.decide('alice', id, 'grant');
    resume.requestResume.mockRejectedValueOnce(new Error('temporarily unavailable'));
    await store.deliver();
    expect((await store.list('alice'))[0]?.resumePending).toBe(true);
    await db.query('update billing_approvals set resume_after = now()');
    resume.requestResume.mockRejectedValueOnce(new HttpError(404, 'no such approval'));
    await new Approvals(db, resume).deliver();
    expect((await store.list('alice'))[0]?.resumePending).toBe(false);
  });
  it('allows only the same fan-out and its children after a grant', async () => {
    charge = { ...charge, at: 'fan-out' };
    const id = await request();
    await store.decide('alice', id, 'grant');
    expect(await store.check(charge)).toEqual({ kind: 'allow' });
    expect(await store.check({ ...charge, taskId: randomUUID(), at: 'task-open' })).toEqual({
      kind: 'allow',
    });
    expect(await store.check({ ...charge, at: 'turn' })).toMatchObject({ kind: 'deny' });
    expect(await store.check({ ...charge, accountId: 'bob' })).toBeNull();
    expect(await store.check({ ...charge, attemptId: randomUUID() })).toBeNull();
  });
  it('persists rejection and refuses foreign, invalid and missing IDs', async () => {
    const id = await request();
    await expect(store.decide('bob', id, 'grant')).rejects.toMatchObject({ status: 404 });
    await expect(store.decide('alice', randomUUID(), 'grant')).rejects.toMatchObject({
      status: 404,
    });
    await expect(store.decide('alice', 'bad', 'grant')).rejects.toMatchObject({ status: 400 });
    await store.decide('alice', id, 'reject');
    await store.decide('alice', id, 'reject');
    expect(await store.check(charge)).toEqual({ kind: 'deny', reason: 'approval rejected' });
    await expect(store.decide('alice', id, 'grant')).rejects.toMatchObject({ status: 409 });
    await store.deliver();
    expect(resume.requestResume).toHaveBeenCalledTimes(1);
  });
  it('keeps decimal matching in SQL and rejects malformed requests', async () => {
    charge = { ...charge, estimate: { dollars: 0.123456 } };
    await request();
    expect((await store.list('alice'))[0]?.estimate).toEqual({ dollars: 0.123456 });
    expect(await store.check({ ...charge, estimate: { dollars: 0.123457 } })).toMatchObject({
      kind: 'deny',
    });
    await expect(store.request({ ...charge, attemptId: 'invalid' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(store.request({ ...charge, estimate: { dollars: -1 } })).rejects.toMatchObject({
      status: 400,
    });
  });
});
