import {
  AccountFailure,
  type AccountStore,
  type AccountView,
  type ProfilePatch,
} from './accounts.js';
import type { AuthSessionStore, NewAuthSession, StoredAuthSession } from './authSessions.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type { PasswordAccount, PasswordAccountStore } from './passwordStrategy.js';

const publicColumns = `id, email, display_name as "displayName", role,
  floor(extract(epoch from created_at) * 1000)::double precision as "createdAt"`;
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
export class PostgresAccountStore implements AccountStore, PasswordAccountStore {
  constructor(private readonly db: IdentityDatabase) {}

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

  replacePassword(accountId: string, expectedHash: string, newHash: string): Promise<boolean> {
    return this.db.withTransaction(async (sql) => {
      if (!(await lockAccount(sql, accountId))) return false;
      if (!(await matchesProof(sql, accountId, expectedHash))) return false;
      const rows = await sql.query<{ id: string }>(
        `update credentials set password_hash = $3
         where account_id = $1 and kind = 'password' and password_hash = $2 returning id`,
        [accountId, expectedHash, newHash],
      );
      return rows.length === 1;
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
  constructor(private readonly db: IdentitySql) {}

  async insert(session: NewAuthSession): Promise<void> {
    await this.db.query(
      `insert into auth_sessions (account_id, token_hash, created_at, expires_at)
       values ($1, $2, to_timestamp($3::double precision / 1000),
         to_timestamp($4::double precision / 1000))`,
      [session.accountId, session.tokenHash, session.createdAt, session.expiresAt],
    );
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
