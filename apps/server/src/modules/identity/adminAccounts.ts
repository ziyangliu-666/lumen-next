/** Identity-owned public summary for billing; never contains credential/session data. */
export interface AccountSummary {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'user' | 'staff';
  readonly suspended: boolean;
  readonly createdAt: number;
}

export type AdminAccountFailureCode = 'account_not_found' | 'invalid_role' | 'invalid_suspension';

/** Domain errors for the calling slice to translate into its own HTTP response. */
export class AdminAccountFailure extends Error {
  constructor(readonly code: AdminAccountFailureCode) {
    super(
      code === 'account_not_found'
        ? 'Account not found'
        : code === 'invalid_role'
          ? 'Invalid account role'
          : 'Invalid suspension value',
    );
    this.name = 'AdminAccountFailure';
  }
}

/** Trusted in-process API. Billing must authorize staff and validate HTTP input first. */
export interface AdminAccounts {
  listAccounts(): Promise<AccountSummary[]>;
  getAccount(id: string): Promise<AccountSummary | null>;
  setRole(id: string, role: 'user' | 'staff'): Promise<void>;
  suspend(id: string, on: boolean): Promise<void>;
}
