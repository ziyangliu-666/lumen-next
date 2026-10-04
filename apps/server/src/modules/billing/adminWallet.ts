import type { FastifyInstance } from 'fastify';
import { requireStaff } from '../../core/http/authGuard.js';
import { badRequest, HttpError, notFound } from '../../core/http/httpError.js';
import type { AdminAccountReader } from './adminRoutes.js';
import type { Ledger } from './ledger.js';
import { UUID } from './validation.js';

export function adminWalletRoutes(
  ledger: Pick<Ledger, 'monthSpend'> | null,
  accounts?: AdminAccountReader,
): (app: FastifyInstance) => void {
  return (app) => {
    app.get<{ Params: { id: string } }>(
      '/api/admin/accounts/:id/wallet',
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        requireStaff(request);
        const { id } = request.params;
        if (!UUID.test(id)) throw badRequest('invalid account id');
        if (!accounts || !ledger) throw new HttpError(503, 'account wallet is unavailable');
        // Do not invent a default wallet for an unknown or tombstoned account.
        if (!(await accounts.getAccount(id))) throw notFound('account is unavailable');
        return ledger.monthSpend(id);
      },
    );
  };
}
