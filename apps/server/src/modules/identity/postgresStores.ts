import {
  AccountFailure,
  type AccountStore,
  type AccountView,
  type DeletionProof,
  type ProfilePatch,
} from './accounts.js';
import type { AccountDeletionParticipant, ActiveAccountWork } from './accountLifecycle.js';
import type { AuthSessionStore, NewAuthSession, StoredAuthSession } from './authSessions.js';
import { AuthFailure } from './authFlow.js';
import { AdminAccountFailure, type AccountSummary } from './adminAccounts.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type { PasswordAccount, PasswordAccountStore } from './passwordStrategy.js';

const publicColumns = `id, email, display_name as "displayName", role,
  floor(extract(epoch from created_at) * 1000)::double precision as "createdAt"`;
function adminSummary(row: AccountSummary): AccountSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    suspended: row.suspended,
    createdAt: row.createdAt,
  };
}

const passwordColumns = `a.id as "accountId", a.role, a.suspended,
  c.password_hash as "passwordHash"`;
const passwordJoin = `from accounts a left join credentials c
  on c.account_id = a.id and c.kind = 'password'`;

interface PasswordRow {
  readonly accountId: string;
  readonly role: 'user' | 'staff';
  readonly suspended: boolean;
  readonly passwordHash: string | null;
}

function passwordAccount(row: PasswordRow | undefined): PasswordAccount | null {
  if (!row) return null;
  return {
    principal: { accountId: row.accountId, role: row.role },
    passwordHash: row.passwordHash,
    suspended: row.suspended,
  };
}

// accounts.id is a uuid; anything else would make PostgreSQL reject the query.
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function emailWrite<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      (error.constraint === 'identity_accounts_email_normalized_key' ||
        error.constraint === 'accounts_email_key')
    ) {
      throw new AccountFailure('email_taken', 'Email is already registered');
    }
    throw error;
  }
}

/** All account writers take the account lock before any credential lock. */
async function lockAccount(sql: IdentitySql, accountId: string): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    'select id from accounts where id = $1 and not suspended for update',
    [accountId],
  );
  return rows.length === 1;
}

async function matchesProof(
  sql: IdentitySql,
  accountId: string,
  expectedHash: string,
): Promise<boolean> {
  const rows = await sql.query<{ passwordHash: string }>(
    `select password_hash as "passwordHash" from credentials
     where account_id = $1 and kind = 'password' for update`,
    [accountId],
  );
  // This is an internal hash version check after password verification, not a
  // comparison of a user-provided password. No expensive hashing under a lock.
  return rows[0]?.passwordHash === expectedHash;
}

/** PostgreSQL implementation; the injected database owns connections/transactions. */
export class PostgresAccountStore implements AccountStore, PasswordAccountStore, ActiveAccountWork {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly onAccountDeleting?: AccountDeletionParticipant,
  ) {}

  /** Not authentication: callers must establish ownership before entering this port. */
  async withActiveAccount<T>(
    accountId: string,
    work: (transaction: IdentitySql) => Promise<T>,
  ): Promise<T> {
    if (!ACCOUNT_ID.test(accountId)) throw new AuthFailure('invalid_credentials');
    return this.db.withTransaction(async (sql) => {
      const rows = await sql.query<{ id: string }>(
        `select id from accounts
         where id = $1 and not suspended and deleted_at is null for update`,
        [accountId],
      );
      if (rows.length !== 1) throw new AuthFailure('invalid_credentials');
      return work(sql);
    });
  }

  createPasswordAccount(input: {
    readonly email: string;
    readonly displayName: string;
    readonly passwordHash: string;
  }): Promise<AccountView> {
    return emailWrite(() =>
      this.db.withTransaction(async (sql) => {
        const rows = await sql.query<AccountView>(
          `insert into accounts (email, display_name, role)
           values ($1, $2, 'user') returning ${publicColumns}`,
          [normalizedEmail(input.email), input.displayName],
        );
        const account = rows[0];
        if (!account) throw new Error('Account insert returned no row');
        await sql.query(
          `insert into credentials (account_id, kind, password_hash)
           values ($1, 'password', $2)`,
          [account.id, input.passwordHash],
        );
        return account;
      }),
    );
  }

  async listAccounts(): Promise<AccountSummary[]> {
    const rows = await this.db.query<AccountSummary>(
      `select ${publicColumns}, suspended from accounts where deleted_at is null
       order by created_at, id`,
      [],
    );
    return rows.map(adminSummary);
  }

  async getAdminAccount(id: string): Promise<AccountSummary | null> {
    const rows = await this.db.query<AccountSummary>(
      `select ${publicColumns}, suspended from accounts where id = $1 and deleted_at is null`,
      [id],
    );
    return rows[0] ? adminSummary(rows[0]) : null;
  }

  async setRole(id: string, role: 'user' | 'staff'): Promise<void> {
    if (role !== 'user' && role !== 'staff') throw new AdminAccountFailure('invalid_role');
    // One atomic UPDATE acquires the account row lock and never changes suspension.
    const rows = await this.db.query<{ id: string }>(
      'update accounts set role = $2 where id = $1 and deleted_at is null returning id',
      [id, role],
    );
    if (rows.length !== 1) throw new AdminAccountFailure('account_not_found');
  }

  /** Trusted in-process admin operation; the HTTP caller must requireStaff first. */
  async suspend(accountId: string, on: boolean): Promise<void> {
    if (typeof on !== 'boolean') throw new AdminAccountFailure('invalid_suspension');
    return this.db.withTransaction(async (sql) => {
      // UPDATE takes the same account lock as session issuance, even on retries.
      const rows = await sql.query<{ id: string }>(
        // A deleted account is not found: staff can neither see nor revive it.
        'update accounts set suspended = $2 where id = $1 and deleted_at is null returning id',
        [accountId, on],
      );
      if (rows.length !== 1) throw new AdminAccountFailure('account_not_found');
      if (on) {
        await sql.query('delete from auth_sessions where account_id = $1', [accountId]);
        // Recovery proofs must not survive into a later unsuspension.
        await sql.query('delete from identity_mail_tokens where account_id = $1', [accountId]);
        await sql.query(
          `delete from identity_mail_requests where state = 'pending' and (account_id = $1
           or email = (select lower(btrim(email)) from accounts where id = $1))`,
          [accountId],
        );
      }
    });
  }

  /**
   * Billing's account eligibility: true only for an account that exists, is not
   * suspended and is not deleted. A malformed id is unknown, not a storage error.
   */
  async canSpend(accountId: string): Promise<boolean> {
    if (!ACCOUNT_ID.test(accountId)) return false;
    const rows = await this.db.query<{ id: string }>(
      'select id from accounts where id = $1 and not suspended and deleted_at is null',
      [accountId],
    );
    return rows.length === 1;
  }

  async getAccount(id: string): Promise<AccountView | null> {
    const rows = await this.db.query<AccountView>(
      `select ${publicColumns} from accounts where id = $1 and not suspended`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<PasswordAccount | null> {
    const rows = await this.db.query<PasswordRow>(
      `select ${passwordColumns} ${passwordJoin} where lower(btrim(a.email)) = $1`,
      [normalizedEmail(email)],
    );
    return passwordAccount(rows[0]);
  }

  async getPasswordAccount(id: string): Promise<PasswordAccount | null> {
    const rows = await this.db.query<PasswordRow>(
      `select ${passwordColumns} ${passwordJoin} where a.id = $1`,
      [id],
    );
    return passwordAccount(rows[0]);
  }

  async updateAccount(input: {
    readonly accountId: string;
    readonly patch: ProfilePatch;
    readonly expectedPasswordHash?: string;
  }): Promise<AccountView | null> {
    const { accountId, patch, expectedPasswordHash } = input;
    if (patch.email !== undefined && expectedPasswordHash === undefined) return null;
    return emailWrite(() =>
      this.db.withTransaction(async (sql) => {
        if (!(await lockAccount(sql, accountId))) return null;
        if (
          expectedPasswordHash !== undefined &&
          !(await matchesProof(sql, accountId, expectedPasswordHash))
        ) {
          return null;
        }
        const rows = await sql.query<AccountView>(
          `update accounts set display_name = coalesce($2::text, display_name),
           email = coalesce($3::text, email) where id = $1 returning ${publicColumns}`,
          [
            accountId,
            patch.displayName ?? null,
            patch.email === undefined ? null : normalizedEmail(patch.email),
          ],
        );
        return rows[0] ?? null;
      }),
    );
  }

  deleteAccount(accountId: string, proof: DeletionProof): Promise<boolean> {
    return this.db.withTransaction(async (sql) => {
      // Account lock first, as every credential writer does, so deletion
      // serializes against sign-in, password change, reset and suspension.
      const locked = await sql.query<{ email: string }>(
        `select lower(btrim(email)) as email from accounts
         where id = $1 and not suspended for update`,
        [accountId],
      );
      const email = locked[0]?.email;
      if (email === undefined) return false;
      if (proof.kind === 'password') {
        if (!(await matchesProof(sql, accountId, proof.expectedHash))) return false;
      } else {
        // The request's own session must still exist and be recent, and the
        // account must not have gained a password meanwhile: a password
        // account always has to prove the password.
        const fresh = await sql.query<{ ok: boolean }>(
          `select true as ok from auth_sessions
           where account_id = $1 and token_hash = $2
             and created_at >= to_timestamp($3::double precision / 1000)
             and expires_at > now()
             and not exists (select 1 from credentials
               where account_id = $1 and kind = 'password')`,
          [accountId, proof.tokenHash, proof.issuedAfter],
        );
        if (fresh.length !== 1) return false;
      }
      // The participant uses this connection while the account lock is held.
      // Failure must abort the whole deletion, never leave a partial tombstone.
      await this.onAccountDeleting?.(accountId, sql);
      // The placeholder can never be registered again: signup and profile
      // validation require a dot in the domain, and `invalid` has none.
      await sql.query(
        `update accounts set email = 'deleted+' || id || '@invalid',
           display_name = 'Deleted account', role = 'user', suspended = true,
           deleted_at = now()
         where id = $1`,
        [accountId],
      );
      // Password and OAuth links: the provider identity may sign up afresh.
      await sql.query('delete from credentials where account_id = $1', [accountId]);
      await sql.query('delete from auth_sessions where account_id = $1', [accountId]);
      await sql.query('delete from identity_mail_tokens where account_id = $1', [accountId]);
      await sql.query('delete from identity_email_verifications where account_id = $1', [
        accountId,
      ]);
      await sql.query('delete from identity_mail_requests where account_id = $1 or email = $2', [
        accountId,
        email,
      ]);
      return true;
    });
  }

  replacePassword(
    accountId: string,
    expectedHash: string,
    newHash: string,
    keepTokenHash?: string,
  ): Promise<boolean> {
    return this.db.withTransaction(async (sql) => {
      if (!(await lockAccount(sql, accountId))) return false;
      if (!(await matchesProof(sql, accountId, expectedHash))) return false;
      const rows = await sql.query<{ id: string }>(
        `update credentials set password_hash = $3
         where account_id = $1 and kind = 'password' and password_hash = $2 returning id`,
        [accountId, expectedHash, newHash],
      );
      if (rows.length !== 1) return false;
      await sql.query(
        'delete from auth_sessions where account_id = $1 and token_hash is distinct from $2',
        [accountId, keepTokenHash ?? null],
      );
      return true;
    });
  }
}

interface SessionRow {
  readonly accountId: string;
  readonly role: 'user' | 'staff';
  readonly suspended: boolean;
  readonly expiresAt: number;
}

export class PostgresAuthSessionStore implements AuthSessionStore {
  constructor(private readonly db: IdentityDatabase) {}

  async insert(session: NewAuthSession): Promise<void> {
    await this.db.withTransaction(async (sql) => {
      // Serialize issuance against suspension and reset; password proofs can go stale.
      if (!(await lockAccount(sql, session.accountId))) {
        throw new AuthFailure('invalid_credentials');
      }
      if (
        session.expectedPasswordHash !== undefined &&
        !(await matchesProof(sql, session.accountId, session.expectedPasswordHash))
      ) {
        throw new AuthFailure('invalid_credentials');
      }
      await sql.query(
        `insert into auth_sessions (account_id, token_hash, created_at, expires_at)
         values ($1, $2, to_timestamp($3::double precision / 1000),
           to_timestamp($4::double precision / 1000))`,
        [session.accountId, session.tokenHash, session.createdAt, session.expiresAt],
      );
    });
  }

  async findByTokenHash(hash: string): Promise<StoredAuthSession | null> {
    const rows = await this.db.query<SessionRow>(
      `select a.id as "accountId", a.role, a.suspended,
       (extract(epoch from s.expires_at) * 1000)::double precision as "expiresAt"
       from auth_sessions s join accounts a on a.id = s.account_id where s.token_hash = $1`,
      [hash],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      principal: { accountId: row.accountId, role: row.role },
      suspended: row.suspended,
      expiresAt: row.expiresAt,
    };
  }

  async deleteByTokenHash(hash: string): Promise<void> {
    await this.db.query('delete from auth_sessions where token_hash = $1', [hash]);
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    await this.db.query('delete from auth_sessions where account_id = $1', [accountId]);
  }
}
