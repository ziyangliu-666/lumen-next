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
        // Acquire the table lock before row locks to avoid lock-upgrade deadlocks.
        // This conservative path is rare and remains disabled on the stub schema.
        await sql.query('lock table accounts in share row exclusive mode', []);
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
        // Only core/resource owners can enable deletion by installing reviewed
        // retention constraints. Do not inspect another slice's business rows.
        // Keep account writes/DDL serialized until COMMIT so the capability
        // check cannot race a constraint change or a second deletion.
        const retention = await sql.query<{ protected: boolean }>(
          `select not exists (
            select 1 from (values ('projects'), ('sessions'), ('ledger_entries')) as required(name)
            where not exists (
              select 1 from pg_constraint c
              join pg_attribute source on source.attrelid = c.conrelid
                and source.attname = 'account_id' and not source.attisdropped
              join pg_attribute target on target.attrelid = c.confrelid
                and target.attname = 'id' and not target.attisdropped
              where c.contype = 'f' and c.convalidated and not c.condeferrable
                and c.conrelid = to_regclass(required.name)
                and c.confrelid = 'accounts'::regclass
                and c.conkey = array[source.attnum]::smallint[]
                and c.confkey = array[target.attnum]::smallint[]
                and c.confdeltype in ('a', 'r')
            )
          ) and not exists (
            select 1 from pg_constraint c
            where c.contype = 'f' and c.confrelid = 'accounts'::regclass
              and c.conrelid in (to_regclass('projects'), to_regclass('sessions'),
                to_regclass('ledger_entries'))
              and c.confdeltype not in ('a', 'r')
          ) as protected`,
          [],
        );
        if (retention[0]?.protected !== true) {
          throw new AccountFailure(
            'account_in_use',
            'Account deletion is unavailable until retention protection is configured',
          );
        }
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
