import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { StripeTopups, stripeFromEnvironment } from './stripe.js';

const config = {
  secretKey: 'sk_test_fixture_only',
  webhookSecret: 'whsec_fixture_only',
  origin: 'https://lumen.test',
};
const client = new Stripe(config.secretKey);
const provider = new StripeTopups(config, client);
const orderId = randomUUID();
function session(): Record<string, unknown> {
  return {
    id: 'cs_test_fixture',
    object: 'checkout.session',
    livemode: false,
    currency: 'usd',
    payment_status: 'paid',
    status: 'complete',
    mode: 'payment',
    payment_intent: 'pi_fixture',
    amount_total: 500,
    client_reference_id: orderId,
    metadata: { lumen_topup: orderId },
  };
}
function signed(
  object = session(),
  overrides: Record<string, unknown> = {},
  timestamp?: number,
): { raw: Buffer; signature: string } {
  const payload = JSON.stringify({
    id: 'evt_fixture',
    object: 'event',
    type: 'checkout.session.completed',
    livemode: false,
    data: { object },
    ...overrides,
  });
  return {
    raw: Buffer.from(payload),
    signature: client.webhooks.generateTestHeaderString({
      payload,
      secret: config.webhookSecret,
      ...(timestamp === undefined ? {} : { timestamp }),
    }),
  };
}
describe('Stripe test-mode adapter', () => {
  it('pins server-owned amount, redirect and order idempotency; sanitizes provider failures', async () => {
    const create = vi.spyOn(client.checkout.sessions, 'create');
    create.mockResolvedValue({
      id: 'cs_test_fixture',
      livemode: false,
      url: 'https://checkout.stripe.com/test',
    } as Stripe.Response<Stripe.Checkout.Session>);
    await provider.checkout({ id: orderId, accountId: 'alice' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        allowed_payment_method_types: ['card'],
        client_reference_id: orderId,
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
        success_url: `https://lumen.test/?topup=returned&order=${orderId}#/settings`,
      }),
      { idempotencyKey: `lumen-topup-${orderId}` },
    );
    create.mockRejectedValueOnce(new Error('secret must not escape'));
    await expect(provider.checkout({ id: orderId, accountId: 'alice' })).rejects.toMatchObject({
      status: 502,
      message: 'Stripe checkout is unavailable; retry the same request',
    });
    for (const response of [
      { livemode: true },
      { id: 'cs_live_invalid' },
      { url: 'https://attacker.test/' },
      { url: null },
    ]) {
      create.mockResolvedValueOnce({
        id: 'cs_test_fixture',
        livemode: false,
        url: 'https://checkout.stripe.com/test',
        ...response,
      } as Stripe.Response<Stripe.Checkout.Session>);
      await expect(provider.checkout({ id: orderId, accountId: 'alice' })).rejects.toMatchObject({
        status: 502,
      });
    }
    create.mockRestore();
  });
  it('verifies actual signed fixtures and rejects tampering and old signatures', () => {
    const { raw, signature } = signed();
    expect(provider.paidEvent(raw, signature)).toEqual({
      orderId,
      checkoutId: 'cs_test_fixture',
      paymentId: 'pi_fixture',
      cents: '500',
    });
    expect(() => provider.paidEvent(Buffer.concat([raw, Buffer.from(' ')]), signature)).toThrow(
      'invalid webhook signature',
    );
    expect(() => provider.paidEvent(raw, 'wrong')).toThrow('invalid webhook signature');
    const old = signed(session(), {}, 1);
    expect(() => provider.paidEvent(old.raw, old.signature)).toThrow('invalid webhook signature');
  });
  it('ignores unrelated/unpaid events and refuses live or mismatched payment data', () => {
    for (const value of [
      signed(session(), { type: 'customer.created' }),
      signed({ ...session(), payment_status: 'unpaid' }),
      signed({ ...session(), metadata: {} }),
    ])
      expect(provider.paidEvent(value.raw, value.signature)).toBeNull();
    for (const patch of [
      { currency: 'eur' },
      { livemode: true },
      { mode: 'subscription' },
      { status: 'open' },
      { client_reference_id: 'foreign' },
      { payment_intent: null },
      { amount_total: null },
      { id: 'cs_live_fixture' },
    ]) {
      const value = signed({ ...session(), ...patch });
      expect(() => provider.paidEvent(value.raw, value.signature)).toThrow();
    }
    const live = signed(session(), { livemode: true });
    expect(() => provider.paidEvent(live.raw, live.signature)).toThrow('live payments');
  });
  it('disables absent secrets, rejects partial/live configuration and requires a trusted origin', () => {
    expect(stripeFromEnvironment({})).toBeUndefined();
    for (const env of [
      { STRIPE_SECRET_KEY: 'sk_test_x' },
      {
        STRIPE_SECRET_KEY: 'sk_live_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        LUMEN_ORIGIN: config.origin,
      },
      {
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'wrong',
        LUMEN_ORIGIN: config.origin,
      },
    ])
      expect(() => stripeFromEnvironment(env)).toThrow();
    expect(
      stripeFromEnvironment({
        STRIPE_SECRET_KEY: config.secretKey,
        STRIPE_WEBHOOK_SECRET: config.webhookSecret,
        LUMEN_ORIGIN: config.origin,
      }),
    ).toEqual(config);
    for (const origin of [
      'http://remote.test',
      'https://lumen.test/path',
      'https://user:password@lumen.test',
    ])
      expect(() => new StripeTopups({ ...config, origin })).toThrow();
    expect(() => new StripeTopups({ ...config, origin: 'http://localhost:4000' })).not.toThrow();
  });
});
