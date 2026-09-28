import type { Money } from '@lumen/contracts';

export interface Spend {
  readonly accountId: string;
  readonly taskId: string;
  readonly amount: Money;
  readonly reason: string;
}
export interface WalletSummary {
  readonly spent: Money;
  readonly cap: Money;
}
