import Stripe from 'stripe';
import { badRequest, HttpError } from '../../core/http/httpError.js';
import type { PaidTopup, TopupOrder, TopupProvider } from './topups.js';

export interface StripeConfiguration {
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly origin: string;
}

export function stripeFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): StripeConfiguration | undefined {
  const secretKey = env['STRIPE_SECRET_KEY'];
  const webhookSecret = env['STRIPE_WEBHOOK_SECRET'];
  if (!secretKey && !webhookSecret) return undefined;
  const origin = env['LUMEN_ORIGIN'];
  if (!secretKey || !webhookSecret || !origin)
    throw new Error('Stripe requires both test secrets and LUMEN_ORIGIN');
  const config = { secretKey, webhookSecret, origin };
  validate(config);
  return config;
}

function validate(config: StripeConfiguration): void {
  if (!/^sk_test_\S+$/.test(config.secretKey) || !/^whsec_\S+$/.test(config.webhookSecret))
    throw new Error('Stripe requires a test secret key and a webhook signing secret');
  const url = new URL(config.origin);
  if (
    url.origin !== config.origin ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error('Stripe requires an HTTPS origin or local HTTP origin');
}

/** Hosted Checkout keeps payment details out of this application. */
export class StripeTopups implements TopupProvider {
  private readonly client: Stripe;
  constructor(
    private readonly config: StripeConfiguration,
    client?: Stripe,
  ) {
    validate(config);
    this.client = client ?? new Stripe(config.secretKey, { timeout: 10000, maxNetworkRetries: 2 });
  }

  async checkout(order: TopupOrder): Promise<{ id: string; url: string }> {
    try {
      const session = await this.client.checkout.sessions.create(
        {
          mode: 'payment',
          adaptive_pricing: { enabled: false },
          allowed_payment_method_types: ['card'],
          client_reference_id: order.id,
          metadata: { lumen_topup: order.id },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: 500,
                product_data: { name: 'Lumen USD 5 test top-up' },
              },
            },
          ],
          success_url: `${this.config.origin}/?topup=returned&order=${order.id}#/settings`,
          cancel_url: `${this.config.origin}/?topup=cancelled#/settings`,
        },
        { idempotencyKey: `lumen-topup-${order.id}` },
      );
      if (
        session.livemode ||
        !session.id.startsWith('cs_test_') ||
        !session.url ||
        new URL(session.url).origin !== 'https://checkout.stripe.com'
      )
        throw new Error('invalid test checkout');
      return { id: session.id, url: session.url };
    } catch {
      // Do not expose provider errors, request details or credentials to HTTP logs.
      throw new HttpError(502, 'Stripe checkout is unavailable; retry the same request');
    }
  }

  paidEvent(body: Buffer, signature: string): PaidTopup | null {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(body, signature, this.config.webhookSecret);
    } catch {
      throw badRequest('invalid webhook signature');
    }
    if (event.type !== 'checkout.session.completed') return null;
    const session = event.data.object;
    if (event.livemode !== false || session.livemode !== false)
      throw badRequest('live payments are not accepted');
    if (session.payment_status !== 'paid') return null;
    // Only this application's persisted orders belong to this webhook.
    const orderId = session.metadata?.['lumen_topup'];
    if (!orderId) return null;
    if (
      session.mode !== 'payment' ||
      session.status !== 'complete' ||
      session.currency !== 'usd' ||
      session.client_reference_id !== orderId ||
      !session.id.startsWith('cs_test_') ||
      typeof session.payment_intent !== 'string' ||
      !session.payment_intent.startsWith('pi_') ||
      !Number.isSafeInteger(session.amount_total)
    )
      throw badRequest('invalid test payment');
    return {
      orderId,
      checkoutId: session.id,
      paymentId: session.payment_intent,
      cents: String(session.amount_total),
    };
  }
}
