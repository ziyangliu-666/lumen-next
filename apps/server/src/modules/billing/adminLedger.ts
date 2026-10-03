import type { FastifyInstance } from 'fastify';
import type { Db } from '../../core/db/db.js';
import { requireStaff } from '../../core/http/authGuard.js';
import { badRequest, HttpError } from '../../core/http/httpError.js';
import type { AdminAccountReader } from './adminRoutes.js';
import { cursorId } from './validation.js';

/** Resolve retained ledger owners through identity's public port, never by email. */
export function adminLedgerRoutes(
  db: Db | null,
  accounts?: AdminAccountReader,
): (app: FastifyInstance) => void {
  return (app) => {
    app.get<{ Querystring: { limit?: string; cursor?: string } }>(
      '/api/admin/ledger',
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        requireStaff(request);
        if (!db || !accounts) throw new HttpError(503, 'ledger administration is unavailable');
        const { limit: rawLimit, cursor } = request.query;
        const limit = rawLimit === undefined ? 20 : Number(rawLimit);
        if (
          (rawLimit !== undefined && !/^\d+$/.test(rawLimit)) ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 100
        )
          throw badRequest('limit must be 1 to 100');
        const boundary = cursor === undefined ? null : cursorId(cursor);
        const rows = await db.query<{
          id: string;
          account_id: string;
          task_id: string | null;
          amount: number;
          created_at: Date;
        }>(
          `select id, account_id, task_id, amount, created_at from ledger_entries
          where $1::uuid is null or (created_at, id) <
            (select created_at, id from ledger_entries where id = $1)
          order by created_at desc, id desc limit $2`,
          [boundary, limit + 1],
        );
        const shown = rows.slice(0, limit);
        const labels = new Map(
          await Promise.all(
            [...new Set(shown.map((row) => row.account_id))].map(async (id) => {
              const account = await accounts.getAccount(id);
              return [id, account === null ? 'Deleted account' : account.displayName] as const;
            }),
          ),
        );
        const last = shown.at(-1);
        return {
          entries: shown.map((row) => ({
            id: row.id,
            accountId: row.account_id,
            accountLabel: labels.get(row.account_id)!,
            taskId: row.task_id,
            amount: { dollars: row.amount },
            createdAt: row.created_at.toISOString(),
          })),
          nextCursor:
            rows.length > limit && last ? Buffer.from(last.id).toString('base64url') : null,
        };
      },
    );
  };
}
