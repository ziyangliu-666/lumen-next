// The routes a worker pod calls while it runs a turn (docs/platform/contract.md,
// "The report"). Each one finds the kernel's WorkerReport for the turn and
// calls the same member with the same arguments. RemoteReport is the other end.
import type { FastifyInstance } from 'fastify';
import type { Money, StepDetail, StepKind } from '@lumen/contracts';
import { WaitingForApproval, type Delegated } from '../../core/domain/worker.js';
import type { QueueWorker, TurnOutcome } from './queueWorker.js';
import { requireInternalKey } from './internal.js';

/** The status that carries WaitingForApproval across the wire. */
export const WAITING_STATUS = 409;
/** The status for any other error a report call raised, such as a delegation too deep. */
export const REPORT_ERROR_STATUS = 422;

type Body = Record<string, unknown>;

export function registerTurnRoutes(app: FastifyInstance, turns: QueueWorker, key: string): void {
  const guard = requireInternalKey(key);

  app.post<{ Params: { turnId: string }; Body: TurnOutcome }>(
    '/internal/turns/:turnId/done',
    { preHandler: guard },
    async (request, reply) => {
      const known = turns.settle(request.params.turnId, request.body);
      return reply.status(known ? 204 : 404).send();
    },
  );

  app.post<{ Params: { turnId: string; member: string }; Body: Body }>(
    '/internal/turns/:turnId/:member',
    { preHandler: guard },
    async (request, reply) => {
      const report = turns.report(request.params.turnId);
      if (!report) return reply.status(404).send({ error: 'no such turn' });
      const body = request.body;
      const taskId = String(body['taskId']);
      try {
        switch (request.params.member) {
          case 'step':
            await report.appendStep(
              taskId,
              body['kind'] as StepKind,
              String(body['text']),
              body['detail'] as StepDetail | undefined,
            );
            return reply.status(204).send();
          case 'delegate':
            return { children: await report.delegate(taskId, body['work'] as Delegated[]) };
          case 'finding':
            return await report.recordFinding(
              taskId,
              String(body['text']),
              typeof body['title'] === 'string' ? body['title'] : undefined,
            );
          case 'spend':
            await report.addSpend(taskId, body['amount'] as Money, String(body['reason']));
            return reply.status(204).send();
          case 'stopped':
            return { stopped: (await report.stopped?.(taskId)) ?? false };
          case 'draft':
            report.draft?.(taskId, String(body['text']));
            return reply.status(204).send();
          case 'retitle':
            await report.retitle?.(taskId, String(body['title']));
            return reply.status(204).send();
          default:
            return reply.status(404).send({ error: 'no such report member' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof WaitingForApproval) {
          return reply.status(WAITING_STATUS).send({ error: message, waiting: true });
        }
        return reply.status(REPORT_ERROR_STATUS).send({ error: message });
      }
    },
  );
}
