import type { PasswordAccount } from './passwordStrategy.js';

export interface AccountView {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'user' | 'staff';
  readonly createdAt: number;
}

export interface AccountReader {
  getAccount(id: string): Promise<AccountView | null>;
}

export interface ProfilePatch {
  readonly email?: string;
  readonly displayName?: string;
}

/** SQL adapters must implement these writes atomically, including uniqueness. */
export interface AccountStore extends AccountReader {
  /** Create both account (role=user) and password credential, or neither. */
  createPasswordAccount(input: {
    readonly email: string;
    readonly displayName: string;
    readonly passwordHash: string;
  }): Promise<AccountView>;
  getPasswordAccount(id: string): Promise<PasswordAccount | null>;
  /**
   * Update an active account only. For email changes, compare the current hash
   * with expectedPasswordHash in the same transaction. Null means unavailable
   * or stale proof; an email uniqueness violation throws email_taken.
   */
  updateAccount(input: {
    readonly accountId: string;
    readonly patch: ProfilePatch;
    readonly expectedPasswordHash?: string;
  }): Promise<AccountView | null>;
  /** Compare-and-set and revoke other sessions atomically; without a hash revoke all. */
  replacePassword(
    accountId: string,
    expectedHash: string,
    newHash: string,
    keepTokenHash?: string,
  ): Promise<boolean>;
}

export type AccountFailureCode =
  | 'invalid_body'
  | 'email_taken'
  | 'account_changed'
  | 'account_in_use';

export class AccountFailure extends Error {
  constructor(
    readonly code: AccountFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'AccountFailure';
  }
}
