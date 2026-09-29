import type { FastifyInstance } from 'fastify';
import type { AccountSummary, AdminAccounts } from '../identity/index.js';
import { requireStaff } from '../../core/http/authGuard.js';
import { badRequest, HttpError, notFound } from '../../core/http/httpError.js';

export type AdminAccountReader = Pick<AdminAccounts, 'listAccounts' | 'getAccount'>;

// Explicit projection keeps future identity fields out of the HTTP response.
function summary(account: AccountSummary): AccountSummary {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    suspended: account.suspended,
    createdAt: account.createdAt,
  };
}

export function adminRoutes(accounts?: AdminAccountReader): (app: FastifyInstance) => void {
  const reader = (): AdminAccountReader => {
    if (!accounts) throw new HttpError(503, 'account administration is unavailable');
    return accounts;
  };
  return (app) => {
    app.get('/api/admin/accounts', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      requireStaff(request);
      return { accounts: (await reader().listAccounts()).map(summary) };
    });
    app.get<{ Params: { id: string } }>('/api/admin/accounts/:id', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      requireStaff(request);
      const { id } = request.params;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw badRequest('invalid account id');
      const account = await reader().getAccount(id);
      if (!account) throw notFound('account is unavailable');
      return { account: summary(account) };
    });
  };
}
