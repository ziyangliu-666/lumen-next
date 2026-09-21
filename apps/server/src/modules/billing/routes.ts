import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, HttpError } from '../../core/http/httpError.js';
import type { Ledger } from './ledger.js';
import { money } from './validation.js';

export function walletRoutes(ledger: Ledger | null): (app: FastifyInstance) => void {
  const store = (): Ledger => {
    if (!ledger) throw new HttpError(503, 'wallet requires a database');
    return ledger;
  };
  return (app) => {
    app.get('/api/wallet', (request) => storeFor(request).monthSpend(request.principal!.accountId));
    app.get<{ Querystring: { limit?: string; cursor?: string } }>(
      '/api/wallet/ledger',
      (request) => {
        const accountId = requireUser(request).accountId;
        const { limit, cursor } = request.query;
        if (limit !== undefined && !/^\d+$/.test(limit)) throw badRequest('invalid limit');
        return store().list(accountId, limit === undefined ? 20 : Number(limit), cursor);
      },
    );
    app.patch('/api/wallet/cap', async (request) => {
      const accountId = requireUser(request).accountId;
      const body = request.body;
      if (!body || typeof body !== 'object' || !('cap' in body))
        throw badRequest('cap is required');
      await store().setCap(accountId, money(body.cap));
      return store().monthSpend(accountId);
    });
  };
  function storeFor(request: Parameters<typeof requireUser>[0]): Ledger {
    requireUser(request);
    return store();
  }
}
