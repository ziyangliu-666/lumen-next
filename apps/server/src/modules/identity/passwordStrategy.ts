import type { Principal } from '../../core/http/authGuard.js';
import type { AuthStrategy } from './authFlow.js';
import { DUMMY_PASSWORD_HASH, isBoundedPassword, verifyPassword } from './passwordHash.js';

export interface PasswordAccount {
  readonly principal: Principal;
  readonly passwordHash: string | null;
  readonly suspended: boolean;
}

/** Storage must use the same normalized email key on signup and lookup. */
export interface PasswordAccountStore {
  findByEmail(normalizedEmail: string): Promise<PasswordAccount | null>;
}

type PasswordVerifier = (password: string, storedHash: string) => Promise<boolean>;

/** Verifies identity only; the shared flow owns login-session issuance. */
export class PasswordStrategy implements AuthStrategy {
  readonly kind = 'password';

  constructor(
    private readonly accounts: PasswordAccountStore,
    private readonly verifyHash: PasswordVerifier = verifyPassword,
  ) {}

  async verify(payload: unknown): Promise<Principal | null> {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    if (!('email' in payload) || !('password' in payload)) return null;
    if (typeof payload.email !== 'string' || typeof payload.password !== 'string') return null;
    // Full address validation belongs to signup. Login needs only a bounded key.
    if (payload.email.length > 320 || !isBoundedPassword(payload.password)) return null;
    const email = payload.email.trim().toLowerCase();
    if (!email) return null;

    const account = await this.accounts.findByEmail(email);
    // Do not skip expensive verification when an address has no password. This
    // reduces the obvious account-existence timing signal, not all timing leaks.
    const matches = await this.verifyHash(
      payload.password,
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!account || !account.passwordHash || account.suspended || !matches) return null;
    return account.principal;
  }
}
