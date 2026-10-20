// The platform's SQL against a real PostgreSQL, in a schema of its own. Skips
// without DATABASE_URL, as every database test here does (core/db/testDb.ts).
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { HttpError } from '../../core/http/httpError.js';
import { INTERNAL_HEADER } from '../shared/internal.js';
import { generateKey, PgApiKeyStore } from './apiKeys.js';
import { registerAskRoutes } from './askRoutes.js';
import { AgentStore, IntentStore, SlugTaken, UsageStore } from './registry.js';

describe.skipIf(!TEST_DATABASE_URL)('platform stores', () => {
  let db: Db;
  let drop: () => Promise<void>;
  let owner: string;
  let consumer: string;

  async function account(name: string, role = 'user'): Promise<string> {
    const [row] = await db.query<{ id: string }>(
      `insert into accounts (email, display_name, role) values ($1, $2, $3) returning id`,
      [`${randomUUID()}@example.com`, name, role],
    );
    return row!.id;
  }

  /** A session with a root task (and a child) as the kernel writes them. */
  async function session(accountId: string, seconds: number, cost: number): Promise<string> {
    const id = randomUUID();
    const rootId = randomUUID();
    await db.query(`insert into sessions (id, project_id, account_id) values ($1, $2, $3)`, [
      id,
      randomUUID(),
      accountId,
    ]);
    await db.query(
      `insert into tasks (id, session_id, parent_id, status, own_cost, started_at, ended_at)
       values ($1, $2, null, 'ended', $3, now() - make_interval(secs => $4), now())`,
      [rootId, id, cost / 2, seconds],
    );
    await db.query(
      `insert into tasks (id, session_id, parent_id, depth, own_cost) values ($1, $2, $3, 1, $4)`,
      [randomUUID(), id, rootId, cost / 2],
    );
    return id;
  }

  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
    owner = await account('Ada');
    consumer = await account('Grace');
  });
  afterAll(() => drop());

  it('keeps a key by its hash, finds it until it is revoked, and lists it', async () => {
    const keys = new PgApiKeyStore(db);
    const fresh = generateKey();
    const created = await keys.create({
      accountId: consumer,
      name: 'watch',
      prefix: fresh.prefix,
      hash: fresh.hash,
      scopes: ['questions:read', 'questions:write'],
    });
    expect(created).toMatchObject({ name: 'watch', prefix: fresh.prefix, lastUsedAt: null });
    expect(await keys.findActive(fresh.hash)).toMatchObject({ id: created.id, role: 'user' });

    await keys.touch(created.id);
    const [touched] = await keys.list(consumer);
    expect(touched?.lastUsedAt).not.toBeNull();

    expect(await keys.revoke(owner, created.id)).toBe(false);
    expect(await keys.revoke(consumer, created.id)).toBe(true);
    expect(await keys.revoke(consumer, created.id)).toBe(false);
    expect(await keys.findActive(fresh.hash)).toBeNull();
    expect((await keys.list(consumer))[0]?.revokedAt).not.toBeNull();
  });

  it('publishes an agent once per slug, and withdraws it without deleting it', async () => {
    const agents = new AgentStore(db);
    const agent = await agents.publish({
      ownerAccountId: owner,
      slug: 'short-lived',
      name: 'Short',
      description: 'd',
      instructions: 'i',
    });
    expect(agent).toMatchObject({ slug: 'short-lived', owner: 'Ada', withdrawnAt: null });
    await expect(
      agents.publish({ ...agent, ownerAccountId: consumer, instructions: 'x' }),
    ).rejects.toBeInstanceOf(SlugTaken);
    await agents.withdraw(agent.id);
    expect((await agents.bySlug('short-lived'))?.withdrawnAt).not.toBeNull();
    expect((await agents.listPublished()).map((each) => each.slug)).not.toContain('short-lived');
  });

  it('lets a worker claim an intent by session id, or else by account and question', async () => {
    const agents = new AgentStore(db);
    const intents = new IntentStore(db);
    const agent = await agents.publish({
      ownerAccountId: owner,
      slug: 'claimer',
      name: 'Claimer',
      description: 'd',
      instructions: 'Be brief.',
    });

    // The worker comes first: the intent has no session yet.
    const early = randomUUID();
    await intents.insert(consumer, agent.id, 'early question');
    expect(await intents.claim(early, consumer, 'early question')).toEqual({
      slug: 'claimer',
      name: 'Claimer',
      instructions: 'Be brief.',
    });
    // A second claim of the same session finds the same row.
    expect((await intents.claim(early, consumer, 'early question'))?.slug).toBe('claimer');
    expect(await intents.agentOfSession(early)).toBe('claimer');

    // The API comes first: the row already carries the session.
    const late = randomUUID();
    const id = await intents.insert(consumer, agent.id, 'late question');
    await intents.attach(id, late);
    expect((await intents.claim(late, consumer, 'other text'))?.slug).toBe('claimer');

    // Another account, or another question, claims nothing.
    await intents.insert(consumer, agent.id, 'mine');
    expect(await intents.claim(randomUUID(), owner, 'mine')).toBeNull();
    expect(await intents.claim(randomUUID(), consumer, 'not mine')).toBeNull();
  });

  it('sums usage per agent and per consumer, with the median time to rest', async () => {
    const agents = new AgentStore(db);
    const intents = new IntentStore(db);
    const usage = new UsageStore(db);
    const agent = await agents.publish({
      ownerAccountId: owner,
      slug: 'measured',
      name: 'Measured',
      description: 'd',
      instructions: 'i',
    });
    for (const [seconds, cost] of [
      [10, 1],
      [20, 2],
      [60, 3],
    ] as const) {
      const sessionId = await session(consumer, seconds, cost);
      await intents.attach(await intents.insert(consumer, agent.id, `q${seconds}`), sessionId);
    }

    const mine = await usage.byAgent(owner);
    const measured = mine.find((row) => row.slug === 'measured');
    expect(measured).toMatchObject({ sessions: 3, cost: 6, owner: 'Ada' });
    expect(measured?.medianSecondsToRest).toBeCloseTo(20, 0);
    expect(mine.find((row) => row.slug === 'claimer')).toMatchObject({ cost: 0 });
    expect(await usage.asConsumer(consumer)).toMatchObject({ sessions: 3, cost: 6 });
    expect(await usage.asConsumer(owner)).toEqual({
      sessions: 0,
      cost: 0,
      medianSecondsToRest: null,
    });
    expect((await usage.byAgent()).length).toBeGreaterThanOrEqual(mine.length);
  });

  it('asks through inject, then attaches the session; a refused project leaves no intent', async () => {
    const internalKey = 'k'.repeat(40);
    const sessionId = randomUUID();
    const seen: Record<string, unknown>[] = [];
    const app = Fastify();
    app.decorateRequest('principal', null);
    app.addHook('onRequest', (request, _reply, done) => {
      request.principal = { accountId: consumer, role: 'user' };
      done();
    });
    app.setErrorHandler((error: unknown, _request, reply) => {
      void reply
        .status(error instanceof HttpError ? error.status : 500)
        .send({ error: error instanceof Error ? error.message : 'error' });
    });
    // The projects slice's route, as the ask route sees it.
    app.post('/api/projects', async (request, reply) => {
      seen.push({ ...(request.body as object), internal: request.headers[INTERNAL_HEADER] });
      const { question } = request.body as { question: string };
      if (question === 'refuse me') return reply.status(503).send({ error: 'session down' });
      return reply.status(201).send({ project: { id: 'p1' }, sessionId });
    });
    const agents = new AgentStore(db);
    await agents.publish({
      ownerAccountId: owner,
      slug: 'asked',
      name: 'Asked',
      description: 'd',
      instructions: 'i',
    });
    registerAskRoutes(app, { agents, intents: new IntentStore(db), internalKey });

    const asked = await app.inject({
      method: 'POST',
      url: '/api/v1/questions',
      payload: { question: ' why? ', agent: 'asked' },
    });
    expect(asked.statusCode).toBe(201);
    expect(asked.json()).toEqual({ sessionId, projectId: 'p1', agent: 'asked' });
    expect(seen[0]).toEqual({ question: 'why?', mode: 'explore', internal: internalKey });
    expect(await new IntentStore(db).agentOfSession(sessionId)).toBe('asked');

    const refused = await app.inject({
      method: 'POST',
      url: '/api/v1/questions',
      payload: { question: 'refuse me' },
    });
    expect(refused.statusCode).toBe(503);
    const left = await db.query(`select 1 from platform_question_intents where question = $1`, [
      'refuse me',
    ]);
    expect(left).toEqual([]);

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/questions',
      payload: { question: 'q', agent: 'nobody-here' },
    });
    expect(unknown.statusCode).toBe(400);
    await app.close();
  });
});
