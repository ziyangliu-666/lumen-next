import { AuthFailure } from '../identity/index.js';
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, forbidden } from '../../core/http/httpError.js';
import type { Secrets } from './secrets.js';

export function keyRoutes(
  store: Secrets,
  origin: string,
  remove: (id: string) => Promise<void>,
): (app: FastifyInstance) => void {
  return (app) => {
    // Scoped hook also covers malformed and oversized request bodies.
    app.addHook('onRequest', (_request, reply, done) => {
      reply.header('Cache-Control', 'no-store');
      done();
    });
    app.get('/api/keys', async (request) => ({
      keys: await store.list(requireUser(request).accountId),
    }));
    app.put('/api/keys/openai', { bodyLimit: 20 * 1024 }, async (request, reply) => {
      const { accountId } = requireUser(request);
      if (request.headers.origin !== origin) throw forbidden('untrusted origin');
      const body = request.body;
      if (
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !('value' in body) ||
        typeof body.value !== 'string' ||
        !body.value.trim() ||
        Buffer.byteLength(body.value, 'utf8') > 16384 ||
        Buffer.from(body.value, 'utf8').toString('utf8') !== body.value
      )
        throw badRequest('invalid key value');
      await store.put(accountId, 'openai', body.value);
      return reply.code(204).send();
    });
    app.delete('/api/keys/openai', async (request, reply) => {
      const { accountId } = requireUser(request);
      if (request.headers.origin !== origin) throw forbidden('untrusted origin');
      if (request.body !== undefined) throw badRequest('unexpected removal body');
      try {
        await remove(accountId);
      } catch (error) {
        // Suspension may commit after cookie resolution but before the account lock.
        if (error instanceof AuthFailure && error.code === 'invalid_credentials')
          throw forbidden('account cannot use keys');
        throw error;
      }
      return reply.code(204).send();
    });
  };
}
