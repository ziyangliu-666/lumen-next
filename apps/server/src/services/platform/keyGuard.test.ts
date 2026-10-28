// The guard on the real buildServer, so the hooks run in the order the
// services run them: buildServer's resolver first, then the guard.
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  anySignedInMayWatch,
  requireUser,
  type Principal,
  type PrincipalResolver,
} from '../../core/http/authGuard.js';
import { buildServer } from '../../core/http/server.js';
import { nullLog } from '../../core/log/log.js';
import { Broker } from '../../core/protocol/broker.js';
import { INTERNAL_HEADER } from '../shared/internal.js';
import {
  generateKey,
  hashKey,
  withApiKeys,
  type ActiveKey,
  type ApiKeyStore,
  type Scope,
} from './apiKeys.js';
import { RateLimiter, registerKeyGuard } from './keyGuard.js';

const INTERNAL = 'i'.repeat(40);
const ACCOUNT = '00000000-0000-4000-8000-000000000001';

function storeOf(keys: { key: string; id: string; scopes: Scope[] }[]): ApiKeyStore {
  return {
    create: () => Promise.reject(new Error('not used')),
    list: () => Promise.resolve([]),
    revoke: () => Promise.resolve(false),
    findActive: (hash) => {
      const found = keys.find((entry) => hashKey(entry.key) === hash);
      const active: ActiveKey | null = found
        ? {
            id: found.id,
            accountId: ACCOUNT,
            name: found.id,
            prefix: found.key.slice(4, 12),
            scopes: found.scopes,
            createdAt: new Date(0).toISOString(),
            lastUsedAt: new Date().toISOString(),
            revokedAt: null,
            role: 'user',
          }
        : null;
      return Promise.resolve(active);
    },
    touch: () => Promise.resolve(),
  };
}

const cookies: PrincipalResolver = {
  resolve: (from) =>
    Promise.resolve(from.cookies['lumen_session'] ? { accountId: 'web', role: 'user' } : null),
};

const reader = generateKey().key;
const writer = generateKey().key;
const revoked = generateKey().key;

describe('keyGuard', () => {
  let app: FastifyInstance;
  let clock = 0;
  afterEach(() => app.close());

  async function setUp(): Promise<void> {
    clock = 0;
    const resolver = withApiKeys(
      cookies,
      storeOf([
        { key: reader, id: 'reader', scopes: ['agents:read'] },
        { key: writer, id: 'writer', scopes: ['agents:read', 'questions:write'] },
      ]),
    );
    app = await buildServer({
      broker: new Broker(),
      resolver,
      access: anySignedInMayWatch,
      log: nullLog,
    });
    registerKeyGuard(app, {
      resolver,
      internalKey: INTERNAL,
      limiter: new RateLimiter(60, 20, () => clock),
    });
    const who = (request: Parameters<typeof requireUser>[0]): Principal => requireUser(request);
    app.get('/api/projects', (request) => who(request));
    app.get('/api/v1/agents', (request) => who(request));
    app.post('/api/v1/questions', (request) => who(request));
    app.post('/api/v1/keys', (request) => who(request));
    app.get('/api/v1/usage', (request) => who(request));
    app.get('/api/v1/openapi.json', () => ({ openapi: '3.1.0' }));
    await app.ready();
  }

  const get = (
    url: string,
    key?: string,
    extra: Record<string, string> = {},
  ): Promise<LightMyRequestResponse> =>
    app.inject({
      method: 'GET',
      url,
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...extra },
    });

  it('answers 403 for a key on a path off /api/v1', async () => {
    await setUp();
    const response = await get('/api/projects', reader);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'an API key works only on /api/v1' });
  });

  it("lets a key off /api/v1 with the internal key: the v1 handler's own inject", async () => {
    await setUp();
    const response = await get('/api/projects', reader, { [INTERNAL_HEADER]: INTERNAL });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accountId: ACCOUNT, role: 'user' });
    const wrong = await get('/api/projects', reader, { [INTERNAL_HEADER]: 'x'.repeat(40) });
    expect(wrong.statusCode).toBe(403);
  });

  it('answers 401 for an unknown or revoked key, even with a cookie', async () => {
    await setUp();
    const response = await get('/api/v1/agents', revoked, { cookie: 'lumen_session=x' });
    expect(response.statusCode).toBe(401);
    expect((await get('/api/v1/agents', 'lmn_bad')).statusCode).toBe(401);
  });

  it("refuses a route the key's scopes do not allow, and a keys route to any key", async () => {
    await setUp();
    expect((await get('/api/v1/agents', reader)).statusCode).toBe(200);
    const usage = await get('/api/v1/usage', reader);
    expect(usage.statusCode).toBe(403);
    expect(usage.json()).toEqual({ error: 'this API key lacks the usage:read scope' });
    const ask = await app.inject({
      method: 'POST',
      url: '/api/v1/questions',
      headers: { authorization: `Bearer ${reader}` },
    });
    expect(ask.statusCode).toBe(403);
    const mint = await app.inject({
      method: 'POST',
      url: '/api/v1/keys',
      headers: { authorization: `Bearer ${writer}` },
    });
    expect(mint.statusCode).toBe(403);
  });

  it('answers 429 with Retry-After after the burst, and refills at 60 a minute', async () => {
    await setUp();
    for (let index = 0; index < 20; index++) {
      expect((await get('/api/v1/agents', reader)).statusCode).toBe(200);
    }
    const over = await get('/api/v1/agents', reader);
    expect(over.statusCode).toBe(429);
    expect(over.headers['retry-after']).toBe('1');
    // Each key has its own bucket.
    expect((await get('/api/v1/agents', writer)).statusCode).toBe(200);
    clock += 1000;
    expect((await get('/api/v1/agents', reader)).statusCode).toBe(200);
    expect((await get('/api/v1/agents', reader)).statusCode).toBe(429);
  });

  it('passes a cookie request untouched, on any path', async () => {
    await setUp();
    const cookie = { cookie: 'lumen_session=x' };
    expect((await get('/api/projects', undefined, cookie)).statusCode).toBe(200);
    expect((await get('/api/v1/usage', undefined, cookie)).statusCode).toBe(200);
    for (let index = 0; index < 30; index++) {
      expect((await get('/api/v1/agents', undefined, cookie)).statusCode).toBe(200);
    }
  });

  it('serves the open document to a key with no scope for it, and 404 for no route', async () => {
    await setUp();
    expect((await get('/api/v1/openapi.json', reader)).statusCode).toBe(200);
    expect((await get('/api/v1/nothing', reader)).statusCode).toBe(404);
  });
});
