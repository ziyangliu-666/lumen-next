// What an API key may reach (docs/platform/public-api.md, "API keys"). It is an
// onRequest hook added after buildServer's own, so request.principal is
// already resolved by withApiKeys when it runs. A cookie request passes
// untouched; the web app's routes stay as they were.
//
// For a request with `Authorization: Bearer lmn_...`, in this order:
// 1. Off /api/v1/*: 403, unless it carries the internal key. That exception is
//    POST /api/v1/questions, which creates the project through inject with
//    the caller's own key, so the project is the caller's and nobody else's.
// 2. An unknown or revoked key: 401.
// 3. Over the key's rate: 429 with Retry-After.
// 4. A route the key's scopes do not allow: 403. A v1 route missing from the
//    table below is refused too, so a new route is closed until it is listed.
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { INTERNAL_HEADER } from '../shared/internal.js';
import { bearerKey, type ApiKeyResolver, type Scope } from './apiKeys.js';

/**
 * The scope each v1 route needs from a key. `null`: no key may call it (the
 * keys themselves are managed with a cookie only). `'open'`: no credential.
 */
export const ROUTE_SCOPES: Readonly<Record<string, Scope | null | 'open'>> = {
  'POST /api/v1/keys': null,
  'GET /api/v1/keys': null,
  'DELETE /api/v1/keys/:id': null,
  'GET /api/v1/agents': 'agents:read',
  'GET /api/v1/agents/:slug': 'agents:read',
  'POST /api/v1/agents': 'agents:write',
  'DELETE /api/v1/agents/:slug': 'agents:write',
  'POST /api/v1/questions': 'questions:write',
  'GET /api/v1/questions/:sessionId': 'questions:read',
  'GET /api/v1/usage': 'usage:read',
  'GET /api/v1/openapi.json': 'open',
};

/** A per-key token bucket: `perMinute` tokens a minute, at most `burst` saved up. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private readonly perMs: number;

  constructor(
    private readonly perMinute = 60,
    private readonly burst = 20,
    private readonly now: () => number = Date.now,
  ) {
    this.perMs = perMinute / 60_000;
  }

  /** Takes one token. Null when allowed; otherwise the seconds until the next token. */
  take(id: string): number | null {
    const at = this.now();
    const bucket = this.buckets.get(id) ?? { tokens: this.burst, at };
    bucket.tokens = Math.min(this.burst, bucket.tokens + (at - bucket.at) * this.perMs);
    bucket.at = at;
    this.buckets.set(id, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return null;
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / this.perMs / 1000));
  }
}

function hasInternalKey(request: FastifyRequest, expected: Buffer): boolean {
  const given = request.headers[INTERNAL_HEADER];
  const actual = Buffer.from(typeof given === 'string' ? given : '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface KeyGuardDeps {
  readonly resolver: ApiKeyResolver;
  /** The shared internal key. A request that carries it may use a key off /api/v1. */
  readonly internalKey: string;
  readonly limiter?: RateLimiter;
}

export function registerKeyGuard(app: FastifyInstance, deps: KeyGuardDeps): void {
  const expected = Buffer.from(deps.internalKey);
  const limiter = deps.limiter ?? new RateLimiter();

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (bearerKey(request.headers.authorization) === null) return;
    const path = request.url.split('?')[0] ?? '';
    const internal = hasInternalKey(request, expected);
    if (!internal && !(path === '/api/v1' || path.startsWith('/api/v1/'))) {
      return reply.status(403).send({ error: 'an API key works only on /api/v1' });
    }
    const key = deps.resolver.keyOf(request.principal);
    if (!key) return reply.status(401).send({ error: 'unknown or revoked API key' });
    // The internal call is part of a v1 request that already paid its token.
    if (internal) return;

    const wait = limiter.take(key.id);
    if (wait !== null) {
      return reply
        .status(429)
        .header('Retry-After', String(wait))
        .send({ error: 'too many requests for this API key' });
    }

    const needed = ROUTE_SCOPES[`${request.method} ${request.routeOptions.url ?? ''}`];
    if (needed === 'open') return;
    if (needed === undefined) {
      // Not a v1 route at all: say so, as for any caller.
      if (request.routeOptions.url === undefined) return;
      return reply.status(403).send({ error: 'no API key may call this route' });
    }
    if (needed === null) {
      return reply.status(403).send({ error: 'this route needs a signed-in user, not an API key' });
    }
    if (!key.scopes.includes(needed)) {
      return reply.status(403).send({ error: `this API key lacks the ${needed} scope` });
    }
  });
}
