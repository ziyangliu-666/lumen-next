import type { IdentitySql } from './identityDatabase.js';

/** Trusted composition callback, not an HTTP authorization or an after-commit event. */
export type AccountDeletionParticipant = (
  accountId: string,
  transaction: IdentitySql,
) => Promise<void>;

/** Identity owns the transaction and the account lock; consumers own their tables. */
export interface ActiveAccountWork {
  /** Parallel reads share a lock; suspension and deletion still wait. */
  withActiveAccountRead<T>(
    accountId: string,
    work: (transaction: IdentitySql) => Promise<T>,
  ): Promise<T>;
  withActiveAccount<T>(
    accountId: string,
    work: (transaction: IdentitySql) => Promise<T>,
  ): Promise<T>;
}
