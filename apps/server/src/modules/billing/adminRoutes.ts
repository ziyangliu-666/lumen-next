import type { FastifyInstance } from 'fastify';
import {
  AdminAccountFailure,
  type StaffAccountChanges,
  type AdminAccountChange,
  type AccountSummary,
  type AdminAccounts,
} from '../identity/index.js';
import { requireStaff } from '../../core/http/authGuard.js';
import { badRequest, forbidden, HttpError, notFound } from '../../core/http/httpError.js';

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

export function adminRoutes(
  accounts?: AdminAccountReader,
  changes?: StaffAccountChanges,
  origin?: string,
): (app: FastifyInstance) => void {
  const reader = (): AdminAccountReader => {
    if (!accounts) throw new HttpError(503, 'account administration is unavailable');
    return accounts;
  };
  return (app) => {
    app.patch<{ Params: { id: string } }>(
      '/api/admin/accounts/:id',
      {
        bodyLimit: 1024,
        onRequest: (_request, reply, done) => {
          reply.header('Cache-Control', 'no-store');
          done();
        },
      },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actor = requireStaff(request);
        if (!origin || request.headers.origin !== origin) throw forbidden('untrusted origin');
        const id = request.params.id;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
          throw badRequest('invalid account id');
        const body = request.body;
        if (
          typeof body !== 'object' ||
          body === null ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1
        )
          throw badRequest('provide one account change');
        let change: AdminAccountChange;
        if ('role' in body && (body.role === 'user' || body.role === 'staff'))
          change = { role: body.role };
        else if ('suspended' in body && typeof body.suspended === 'boolean')
          change = { suspended: body.suspended };
        else throw badRequest('invalid account change');
        if (!changes) throw new HttpError(503, 'account changes are unavailable');
        try {
          const account = await changes.changeAccount(actor.accountId, id, change);
          app.log.info(
            { actorId: actor.accountId, targetId: id, change },
            'account administration changed',
          );
          return { account: summary(account) };
        } catch (error) {
          if (error instanceof AdminAccountFailure) {
            if (error.code === 'actor_forbidden')
              throw forbidden('staff access changed; sign in again');
            if (error.code === 'self_change')
              throw forbidden('you cannot change your own account here');
            if (error.code === 'account_not_found') throw notFound('account is unavailable');
            throw badRequest('invalid account change');
          }
          throw error;
        }
      },
    );

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
