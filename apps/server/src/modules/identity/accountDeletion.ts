import { AccountFailure } from './accounts.js';
import { AuthFailure } from './authFlow.js';
import type { IdentityDatabase } from './identityDatabase.js';
import { DUMMY_PASSWORD_HASH, isBoundedPassword, verifyPassword } from './passwordHash.js';
import { PostgresAccountStore } from './postgresStores.js';

/** Password-account deletion only; dependent resources are NEVER cascaded. */
export class AccountDeletion {
  constructor(private readonly db: IdentityDatabase) {}

  async remove(accountId: string, input: unknown): Promise<void> {
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'currentPassword') ||
      !('currentPassword' in input) ||
      typeof input.currentPassword !== 'string' ||
      !isBoundedPassword(input.currentPassword)
    ) {
      throw new AccountFailure('invalid_body', 'Provide the current password');
    }
    const account = await new PostgresAccountStore(this.db).getPasswordAccount(accountId);
    const matches = await verifyPassword(
      input.currentPassword,
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!account || account.suspended || !account.passwordHash || !matches)
      throw new AuthFailure('invalid_credentials');
    const expectedHash = account.passwordHash;
    try {
      await this.db.withTransaction(async (sql) => {
        const active = await sql.query(
          'select id from accounts where id = $1 and not suspended for update',
          [accountId],
        );
        if (!active.length) throw new AuthFailure('invalid_credentials');
        const credential = await sql.query<{ passwordHash: string }>(
          `select password_hash as "passwordHash" from credentials where account_id = $1 and kind = 'password' for update`,
          [accountId],
        );
        if (credential[0]?.passwordHash !== expectedHash)
          throw new AccountFailure('account_changed', 'Account changed; sign in and try again');
        await sql.query('delete from auth_sessions where account_id = $1', [accountId]);
        await sql.query('delete from credentials where account_id = $1', [accountId]);
        // Foreign keys to projects/ledger intentionally reject this DELETE. The
        // transaction then restores credentials/sessions, with no lost user data.
        await sql.query('delete from accounts where id = $1', [accountId]);
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23503'
      ) {
        throw new AccountFailure(
          'account_in_use',
          'Account has retained resources; deletion requires a reviewed retention workflow',
        );
      }
      throw error;
    }
  }
}
