// /api/v1/keys, in the identity service (docs/platform/public-api.md). A key is
// created, listed and revoked by a signed-in user with a cookie. keyGuard
// already refuses these routes to a key; the check here holds even where the
// guard is not registered, so one key can never mint another.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireUser, type Principal } from '../../core/http/authGuard.js';
import { badRequest, forbidden, notFound } from '../../core/http/httpError.js';
import {
  generateKey,
  isScope,
  type ApiKey,
  type ApiKeyResolver,
  type ApiKeyStore,
  type Scope,
} from './apiKeys.js';

export interface KeyRouteDeps {
  readonly store: ApiKeyStore;
  readonly resolver: ApiKeyResolver;
}

const MAX_NAME = 100;

function view(key: ApiKey): Omit<ApiKey, 'accountId'> {
  const { accountId: _accountId, ...rest } = key;
  return rest;
}

export function keyRequestOf(body: unknown): { name: string; scopes: Scope[] } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('body must be an object');
  }
  const { name, scopes, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw badRequest('unexpected field');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME) {
    throw badRequest(`name must be 1 to ${MAX_NAME} characters`);
  }
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(isScope)) {
    throw badRequest('scopes must be a non-empty list of known scopes');
  }
  return { name: name.trim(), scopes: [...new Set(scopes)] };
}

export function registerKeyRoutes(app: FastifyInstance, deps: KeyRouteDeps): void {
  const cookieUser = (request: FastifyRequest): Principal => {
    const principal = requireUser(request);
    if (deps.resolver.keyOf(principal)) {
      throw forbidden('this route needs a signed-in user, not an API key');
    }
    return principal;
  };

  app.post('/api/v1/keys', async (request, reply) => {
    const principal = cookieUser(request);
    const { name, scopes } = keyRequestOf(request.body);
    const fresh = generateKey();
    const key = await deps.store.create({
      accountId: principal.accountId,
      name,
      prefix: fresh.prefix,
      hash: fresh.hash,
      scopes,
    });
    const { id, prefix, createdAt } = key;
    return reply.status(201).send({ id, name, prefix, scopes, createdAt, key: fresh.key });
  });

  app.get('/api/v1/keys', async (request) => {
    const principal = cookieUser(request);
    return { items: (await deps.store.list(principal.accountId)).map(view) };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/keys/:id', async (request, reply) => {
    const principal = cookieUser(request);
    if (!(await deps.store.revoke(principal.accountId, request.params.id))) {
      throw notFound('no such key');
    }
    return reply.status(204).send();
  });
}
