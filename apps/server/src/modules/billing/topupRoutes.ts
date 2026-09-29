import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, forbidden, HttpError } from '../../core/http/httpError.js';
import type { Topups, TopupProvider } from './topups.js';

export function topupRoutes(
  store: Topups | null,
  provider: TopupProvider | undefined,
  origin: string | undefined,
  canSpend: (id: string) => Promise<boolean>,
): (app: FastifyInstance) => void {
  return (app) => {
    const required = (): { store: Topups; provider: TopupProvider } => {
      if (!store || !provider) throw new HttpError(503, 'test top-ups are unavailable');
      return { store, provider };
    };
    app.get('/api/wallet/topups', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const { accountId } = requireUser(request);
      return {
        enabled: !!provider && !!store,
        receipts: store ? await store.receipts(accountId) : [],
      };
    });
    app.post('/api/wallet/topups/checkout', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const { accountId } = requireUser(request);
      if (!origin || request.headers.origin !== origin) throw forbidden('untrusted origin');
      if (!(await canSpend(accountId))) throw forbidden('account cannot spend');
      const body = request.body;
      if (
        !body ||
        typeof body !== 'object' ||
        !('requestId' in body) ||
        typeof body.requestId !== 'string' ||
        !('offer' in body) ||
        body.offer !== 'usd5'
      )
        throw badRequest('choose the USD 5 test top-up');
      const ready = required();
      const order = await ready.store.order(accountId, body.requestId);
      const checkout = await ready.provider.checkout(order);
      await ready.store.attach(order.id, checkout.id);
      return { url: checkout.url };
    });
    // Encapsulation keeps raw bytes local to this endpoint; other routes retain JSON parsing.
    void app.register((webhooks, _options, done) => {
      webhooks.removeContentTypeParser('application/json');
      webhooks.addContentTypeParser(
        'application/json',
        { parseAs: 'buffer' },
        (_request, body, done) => {
          done(null, body);
        },
      );
      webhooks.post('/api/billing/stripe/webhook', { bodyLimit: 262144 }, async (request) => {
        const ready = required();
        const signature = request.headers['stripe-signature'];
        if (typeof signature !== 'string' || !Buffer.isBuffer(request.body))
          throw badRequest('invalid webhook signature');
        const payment = ready.provider.paidEvent(request.body, signature);
        if (payment) await ready.store.credit(payment);
        return { received: true };
      });
      done();
    });
  };
}
