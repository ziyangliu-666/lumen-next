import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import type { IdentityDatabase } from './identityDatabase.js';
import type { IdentityMail } from './mail.js';
import { MailActions } from './mailActions.js';
import { MailQueue, MailWorker, type MailEvent } from './mailQueue.js';
import { PostgresAccountStore } from './postgresStores.js';

const origin = 'https://lumen.example';
const key = 'k'.repeat(32);

function codeOf(message: IdentityMail | undefined): string {
  const code = message?.text.match(/\n([A-Za-z0-9_-]{43})\n/)?.[1];
  expect(code).toBeDefined();
  return code!;
}

describe.skipIf(!TEST_DATABASE_URL)('identity: queued mail delivery', () => {
  let fixture: Awaited<ReturnType<typeof openTestDb>>;
  let db: IdentityDatabase;
  let accounts: PostgresAccountStore;
  const sent: IdentityMail[] = [];
  const send = vi.fn((message: IdentityMail): Promise<void> => {
    sent.push(message);
    return Promise.resolve();
  });
  const events: MailEvent[] = [];
  let queue: MailQueue;
  let worker: MailWorker;
  let actions: MailActions;

  beforeAll(async () => {
    fixture = await openTestDb();
    db = fixture.db;
    accounts = new PostgresAccountStore(db);
  }, 60_000);
  beforeEach(async () => {
    await db.query('truncate accounts cascade; truncate identity_mail_requests', []);
    sent.length = 0;
    events.length = 0;
    send.mockClear();
    queue = new MailQueue(db, { key, event: (e) => events.push(e) });
    worker = new MailWorker(db, { send }, origin, { event: (e) => events.push(e) });
    actions = new MailActions(db, queue);
  });
  afterAll(async () => {
    await fixture?.drop();
  });

  async function passwordAccount(email = `${randomUUID()}@example.test`): Promise<{
    id: string;
    email: string;
  }> {
    const account = await accounts.createPasswordAccount({
      email,
      displayName: 'Mail',
      passwordHash: 'old-hash',
    });
    return { id: account.id, email };
  }
  async function providerOnlyAccount(email: string): Promise<void> {
    await db.query('insert into accounts (email, display_name) values ($1, $2)', [email, 'P']);
  }
  function requests(): Promise<{ state: string; attempts: number }[]> {
    return db.query('select state, attempts from identity_mail_requests order by requested_at', []);
  }
  function tokens(): Promise<unknown[]> {
    return db.query('select token_hash from identity_mail_tokens', []);
  }

  it('admits every well-formed address with the same statements and no send', async () => {
    const eligible = await passwordAccount();
    const suspended = await passwordAccount();
    await accounts.suspend(suspended.id, true);
    await providerOnlyAccount('provider@example.test');
    const statements: string[] = [];
    const recording: IdentityDatabase = {
      query: (text, values) => {
        statements.push(text);
        return db.query(text, values);
      },
      withTransaction: (work) =>
        db.withTransaction((sql) =>
          work({
            query: (text, values) => {
              statements.push(text);
              return sql.query(text, values);
            },
          }),
        ),
    };
    const recorded = new MailActions(recording, new MailQueue(recording, { key }));
    const shapes: string[] = [];
    for (const email of [
      'unknown@example.test',
      eligible.email,
      suspended.email,
      'provider@example.test',
    ]) {
      statements.length = 0;
      await recorded.requestReset(email);
      shapes.push(JSON.stringify(statements));
    }
    // No account table is read on the public path, and every address runs the same SQL.
    expect(shapes[0]).not.toMatch(/accounts|credentials/);
    expect(new Set(shapes).size).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(await requests()).toHaveLength(4);
  });

  it('holds the per-address cap under concurrent requests', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    await actions.requestReset(account.email);
    const emailKey = createHmac('sha256', key).update(account.email).digest('hex');
    let inserted = (): void => {};
    const insertedPromise = new Promise<void>((resolve) => (inserted = resolve));
    let commit = (): void => {};
    const committed = new Promise<void>((resolve) => (commit = resolve));
    // A concurrent admission that has inserted the third request but not committed yet.
    const concurrent = db.withTransaction(async (sql) => {
      await sql.query("select pg_advisory_xact_lock(hashtext('identity_mail'), hashtext($1))", [
        emailKey,
      ]);
      await sql.query(
        `insert into identity_mail_requests (purpose, email, email_key) values ('reset', $1, $2)`,
        [account.email, emailKey],
      );
      inserted();
      await committed;
    });
    await insertedPromise;
    const fourth = actions.requestReset(account.email);
    for (let i = 0; i < 100; i++) {
      const waiting = await db.query<{ n: number }>(
        'select count(*)::int as n from pg_locks where not granted',
        [],
      );
      if (waiting[0]!.n > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    commit();
    await concurrent;
    await fourth;
    expect(await requests()).toHaveLength(3);
    expect(events.filter((e) => e === 'dropped')).toHaveLength(1);
  });

  it('lets a suspension and a worker claim on the same account both finish without deadlock', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    let suspendedRowLocked = (): void => {};
    const locked = new Promise<void>((resolve) => (suspendedRowLocked = resolve));
    let releaseSuspension = (): void => {};
    const release = new Promise<void>((resolve) => (releaseSuspension = resolve));
    // Suspension takes the account lock, then pauses before purging mail requests.
    const pausing: IdentityDatabase = {
      query: (text, values) => db.query(text, values),
      withTransaction: (work) =>
        db.withTransaction((sql) =>
          work({
            async query(text, values) {
              const rows = await sql.query(text, values);
              if (text.startsWith('update accounts set suspended')) {
                suspendedRowLocked();
                await release;
              }
              return rows as never;
            },
          }),
        ),
    };
    const suspension = new PostgresAccountStore(pausing).suspend(account.id, true);
    await locked;
    const tick = worker.tick();
    // Wait until the worker is really blocked in PostgreSQL behind the account lock.
    for (let i = 0; i < 250; i++) {
      const waiting = await db.query<{ n: number }>(
        'select count(*)::int as n from pg_locks where not granted',
        [],
      );
      if (waiting[0]!.n > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    releaseSuspension();
    await expect(suspension).resolves.toBeUndefined();
    await expect(tick).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(await requests()).toEqual([]);
  }, 20_000);

  it('stops between requests instead of finishing the whole batch', async () => {
    for (let n = 0; n < 3; n++) await actions.requestReset((await passwordAccount()).email);
    let stopping: Promise<void> | undefined;
    send.mockImplementationOnce((message) => {
      sent.push(message);
      stopping = worker.stop();
      return Promise.resolve();
    });
    await worker.tick();
    await stopping;
    expect(sent).toHaveLength(1);
  });

  it('reports a failed tick as a value-free error event', async () => {
    const broken: IdentityDatabase = {
      query: () => Promise.reject(new Error('private database failure')),
      withTransaction: () => Promise.reject(new Error('private database failure')),
    };
    const failing = new MailWorker(broken, { send }, origin, { event: (e) => events.push(e) });
    failing.start(5);
    for (let i = 0; i < 100 && !events.includes('error'); i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    await failing.stop();
    expect(events).toContain('error');
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it('sends only to eligible addresses and marks the rest done without a code', async () => {
    const eligible = await passwordAccount();
    const suspended = await passwordAccount();
    await accounts.suspend(suspended.id, true);
    await providerOnlyAccount('provider@example.test');
    for (const email of [
      'unknown@example.test',
      eligible.email,
      suspended.email,
      'provider@example.test',
    ])
      await actions.requestReset(email);
    await worker.tick();
    expect(sent.map((message) => message.to)).toEqual([eligible.email]);
    expect(await requests()).toEqual(Array(4).fill({ state: 'done', attempts: 1 }));
    expect(await tokens()).toHaveLength(1);
    expect(events.filter((e) => e === 'ineligible')).toHaveLength(3);
    expect(events).toContain('sent');
  });

  it('stores only the hash of a delivered code, and the code resets once', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    await worker.tick();
    const code = codeOf(sent[0]);
    expect(JSON.stringify(await tokens())).not.toContain(code);
    expect(
      JSON.stringify(await db.query('select * from identity_mail_requests', [])),
    ).not.toContain(code);
    await actions.resetPassword(code, 'a new sufficiently long password');
    await expect(actions.resetPassword(code, 'another long password here')).rejects.toMatchObject({
      code: 'invalid_body',
    });
  });

  it('retries a failed delivery later and never leaves the undelivered code usable', async () => {
    const account = await passwordAccount();
    let undelivered = '';
    send.mockImplementationOnce((message) => {
      undelivered = codeOf(message);
      return Promise.reject(new Error('private provider failure'));
    });
    await actions.requestReset(account.email);
    await worker.tick();
    expect(await requests()).toEqual([{ state: 'pending', attempts: 1 }]);
    expect(await tokens()).toHaveLength(0);
    await expect(actions.resetPassword(undelivered, 'a new long password')).rejects.toMatchObject({
      code: 'invalid_body',
    });
    expect(events).toContain('retry');
    // Not due yet: a second tick does nothing.
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(1);
    await db.query('update identity_mail_requests set not_before = now()', []);
    await worker.tick();
    expect(sent).toHaveLength(1);
    expect(await requests()).toEqual([{ state: 'done', attempts: 2 }]);
  });

  it('gives up after the attempt limit and counts the failure without details', async () => {
    const account = await passwordAccount();
    send.mockRejectedValue(new Error('private provider failure'));
    try {
      await actions.requestReset(account.email);
      for (let attempt = 0; attempt < 5; attempt++) {
        await db.query('update identity_mail_requests set not_before = now()', []);
        await worker.tick();
      }
      expect(await requests()).toEqual([{ state: 'failed', attempts: 5 }]);
      expect(events.filter((e) => e === 'failed')).toHaveLength(1);
      expect(JSON.stringify(events)).not.toContain('private');
    } finally {
      send.mockReset();
      send.mockImplementation((message) => {
        sent.push(message);
        return Promise.resolve();
      });
    }
  });

  it('fails a request that could not be sent within an hour', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    await db.query(
      "update identity_mail_requests set requested_at = now() - interval '61 minutes'",
      [],
    );
    await worker.tick();
    expect(send).not.toHaveBeenCalled();
    expect(await requests()).toEqual([{ state: 'failed', attempts: 0 }]);
  });

  it('suspension purges pending requests and codes, so unsuspension restores nothing', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    await worker.tick();
    const code = codeOf(sent[0]);
    await actions.requestReset(account.email);
    await accounts.suspend(account.id, true);
    expect(await requests()).toEqual([{ state: 'done', attempts: 1 }]);
    expect(await tokens()).toHaveLength(0);
    await accounts.suspend(account.id, false);
    await expect(actions.resetPassword(code, 'a new long password')).rejects.toMatchObject({
      code: 'invalid_body',
    });
  });

  it('lets two workers on one database claim disjoint requests', async () => {
    const first = await passwordAccount();
    const second = await passwordAccount();
    await actions.requestReset(first.email);
    await actions.requestReset(second.email);
    const other = new MailWorker(db, { send }, origin);
    await Promise.all([worker.tick(), other.tick()]);
    expect(sent.map((message) => message.to).sort()).toEqual([first.email, second.email].sort());
  });

  it('delivers a request admitted before a restart', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    const restarted = new MailWorker(db, { send }, origin);
    await restarted.tick();
    expect(sent.map((message) => message.to)).toEqual([account.email]);
  });

  it('supersedes an older pending request once a newer one is delivered', async () => {
    const account = await passwordAccount();
    send.mockRejectedValueOnce(new Error('transient'));
    await actions.requestReset(account.email);
    await worker.tick();
    await actions.requestReset(account.email);
    await worker.tick();
    const code = codeOf(sent[0]);
    await db.query('update identity_mail_requests set not_before = now()', []);
    await worker.tick();
    // The older request did not send again and replace the newer code.
    expect(sent).toHaveLength(1);
    await actions.resetPassword(code, 'a new sufficiently long password');
  });

  it('drops the fourth request for one address in an hour with the same response', async () => {
    const account = await passwordAccount();
    for (let request = 0; request < 4; request++) await actions.requestReset(account.email);
    expect(await requests()).toHaveLength(3);
    expect(events.filter((e) => e === 'admitted')).toHaveLength(3);
    expect(events.filter((e) => e === 'dropped')).toHaveLength(1);
  });

  it('deletes finished requests and expired codes after a day', async () => {
    const account = await passwordAccount();
    await actions.requestReset(account.email);
    await worker.tick();
    await db.query(
      "update identity_mail_requests set requested_at = now() - interval '25 hours'",
      [],
    );
    await db.query("update identity_mail_tokens set expires_at = now() - interval '1 second'", []);
    await worker.tick();
    expect(await requests()).toEqual([]);
    expect(await tokens()).toEqual([]);
  });

  it('queues verification for the signed-in account email only', async () => {
    const account = await passwordAccount();
    await actions.requestVerification(account.id);
    await worker.tick();
    const code = codeOf(sent[0]);
    expect(sent[0]?.to).toBe(account.email);
    await actions.verifyEmail(account.id, code);
    expect(await actions.status(account.id)).toEqual({ verified: true });
  });

  it('rejects a queue key too short to protect the address index', () => {
    const sql: IdentityDatabase = {
      query: () => Promise.resolve([]),
      withTransaction: () => Promise.reject(new Error('unused')),
    };
    expect(() => new MailQueue(sql, { key: 'short' })).toThrow('Invalid mail queue key');
  });
});
