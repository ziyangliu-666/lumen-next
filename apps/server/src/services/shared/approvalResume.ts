import type { FastifyInstance } from 'fastify';
import type { BudgetApprovalResume } from '../../core/domain/budget.js';
import { internalCaller, requireInternalKey } from './internal.js';

const path = '/internal/approvals/resume';

/** Billing delivers its durable decision to the session process that owns the kernel. */
export function remoteApprovalResume(url: string, key: string): BudgetApprovalResume {
  const call = internalCaller(url, key);
  return {
    requestResume: async (input) => {
      await call(path, input);
    },
  };
}

/** The same protected HTTP boundary is used by the service and its acceptance tests. */
export function registerApprovalResume(
  server: FastifyInstance,
  approvals: BudgetApprovalResume,
  key: string,
): void {
  server.post<{ Body: Parameters<BudgetApprovalResume['requestResume']>[0] }>(
    path,
    { preHandler: requireInternalKey(key) },
    async (request, reply) => {
      await approvals.requestResume(request.body);
      return reply.status(204).send();
    },
  );
}
