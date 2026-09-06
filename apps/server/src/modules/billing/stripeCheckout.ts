import type { Money } from '@lumen/contracts';

// Stripe top-up. Sprint work: a real Checkout session; here a typed seam so the
// wallet page and the ledger can be built against it first.
export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
  readonly amount: Money;
}

export interface PaymentGateway {
  createTopUp(accountId: string, amount: Money): Promise<CheckoutSession>;
}
