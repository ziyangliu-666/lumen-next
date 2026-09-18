// Public index for the billing slice. Owner: HE RONG.
import type { FastifyInstance } from 'fastify';
import { requireStaff } from '../../core/http/authGuard.js';
import { badRequest, notFound } from '../../core/http/httpError.js';
import type { AdminAccounts } from '../identity/index.js';

export interface BillingSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Compose billing's HTTP boundary around identity's trusted in-process API. */
export function createBillingSlice(deps: { readonly accounts: AdminAccounts }): BillingSlice {
  return {
    registerRoutes(app): void {
      app.get('/api/admin/accounts', async (request, reply) => {
        requireStaff(request);
        reply.header('cache-control', 'no-store');
        return deps.accounts.listAccounts();
      });

      app.get<{ Params: { id: string } }>('/api/admin/accounts/:id', async (request, reply) => {
        requireStaff(request);
        if (!UUID.test(request.params.id)) throw badRequest('invalid account id');
        const account = await deps.accounts.getAccount(request.params.id);
        if (!account) throw notFound('account not found');
        reply.header('cache-control', 'no-store');
        return account;
      });
    },
  };
}
