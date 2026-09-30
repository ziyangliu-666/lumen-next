import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { forbidden, HttpError } from '../../core/http/httpError.js';
import type { Approvals } from './approvals.js';

export function approvalRoutes(
  store: Approvals | null,
  origin: string | undefined,
  canSpend: (id: string) => Promise<boolean>,
): (app: FastifyInstance) => void {
  return (app) => {
    const required = (): Approvals => {
      if (!store) throw new HttpError(503, 'approvals are unavailable');
      return store;
    };
    app.get('/api/wallet/approvals', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const { accountId } = requireUser(request);
      return { approvals: await required().list(accountId) };
    });
    for (const action of ['grant', 'reject'] as const) {
      app.post<{ Params: { id: string } }>(
        `/api/wallet/approvals/:id/${action}`,
        async (request, reply) => {
          reply.header('Cache-Control', 'no-store');
          const { accountId } = requireUser(request);
          if (!origin || request.headers.origin !== origin) throw forbidden('untrusted origin');
          if (!(await canSpend(accountId))) throw forbidden('account cannot spend');
          const approval = await required().decide(accountId, request.params.id, action);
          return reply.code(202).send({ approval });
        },
      );
    }
    if (store) {
      let timer: ReturnType<typeof setInterval> | undefined;
      let active: Promise<void> | undefined;
      const tick = (): void => {
        if (active) return;
        active = store
          .deliver()
          .catch(() => {
            app.log.error('billing approval delivery failed');
          })
          .finally(() => {
            active = undefined;
          });
      };
      app.addHook('onReady', (done) => {
        tick();
        timer = setInterval(tick, 1000);
        timer.unref();
        done();
      });
      app.addHook('onClose', async () => {
        clearInterval(timer);
        await active;
      });
    }
  };
}
