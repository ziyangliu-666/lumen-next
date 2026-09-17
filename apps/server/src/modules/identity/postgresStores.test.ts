import { describe, expect, it } from 'vitest';
import { AccountFailure } from './accounts.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';

// Query-contract tests only: this double does not execute SQL or prove locking.
class RecordingDatabase implements IdentityDatabase {
  readonly calls: { sql: string; values: readonly unknown[]; transaction: boolean }[] = [];
  readonly transactions: string[] = [];
  readonly results: (object[] | Error)[] = [];

  private execute<Row extends object>(
    sql: string,
    values: readonly unknown[],
    transaction: boolean,
  ): Promise<Row[]> {
    this.calls.push({ sql, values, transaction });
    const result = this.results.shift();
    if (result instanceof Error) return Promise.reject(result);
    if (!result) return Promise.reject(new Error('Unexpected SQL query'));
    return Promise.resolve(result as Row[]);
  }

  query<Row extends object>(sql: string, values: readonly unknown[]): Promise<Row[]> {
    return this.execute<Row>(sql, values, false);
  }

  async withTransaction<T>(work: (sql: IdentitySql) => Promise<T>): Promise<T> {
    this.transactions.push('begin');
    try {
      const result = await work({
        query: <Row extends object>(sql: string, values: readonly unknown[]) =>
          this.execute<Row>(sql, values, true),
      });
      this.transactions.push('commit');
      return result;
    } catch (error) {
      this.transactions.push('rollback');
      throw error;
    }
  }
}

const account = {
  id: 'account-id',
  email: 'user@example.edu',
  displayName: 'User',
  role: 'user' as const,
  createdAt: 1000,
};

function uniqueFailure(constraint: string): Error {
  return Object.assign(new Error('Database details must stay private'), {
    code: '23505',
    constraint,
  });
}

describe('identity: PostgreSQL account query contract', () => {
  it('creates the account and credential on the same transaction connection', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], []);
    const store = new PostgresAccountStore(db);
    expect(
      await store.createPasswordAccount({
        email: ' USER@Example.edu ',
        displayName: "Name'); --",
        passwordHash: 'scrypt-hash',
      }),
    ).toEqual(account);
    expect(db.transactions).toEqual(['begin', 'commit']);
    expect(db.calls.every((call) => call.transaction)).toBe(true);
    expect(db.calls[0]?.values).toEqual(['user@example.edu', "Name'); --"]);
    expect(db.calls[0]?.sql).not.toContain("Name'); --");
    expect(db.calls[0]?.sql).toContain("'user'");
    expect(db.calls[1]?.values).toEqual([account.id, 'scrypt-hash']);
  });

  it('propagates credential failure through the transaction rollback boundary', async () => {
    const db = new RecordingDatabase();
    const failure = new Error('credential write failed');
    db.results.push([account], failure);
    await expect(
      new PostgresAccountStore(db).createPasswordAccount({
        email: account.email,
        displayName: account.displayName,
        passwordHash: 'hash',
      }),
    ).rejects.toBe(failure);
    expect(db.transactions).toEqual(['begin', 'rollback']);
  });

  it('treats a missing INSERT RETURNING row as an infrastructure error', async () => {
    const db = new RecordingDatabase();
    db.results.push([]);
    await expect(
      new PostgresAccountStore(db).createPasswordAccount({
        email: account.email,
        displayName: account.displayName,
        passwordHash: 'hash',
      }),
    ).rejects.toThrow('Account insert returned no row');
    expect(db.transactions).toEqual(['begin', 'rollback']);
  });

  it.each(['identity_accounts_email_normalized_key', 'accounts_email_key'])(
    'maps the known email constraint %s after rollback',
    async (constraint) => {
      const db = new RecordingDatabase();
      db.results.push(uniqueFailure(constraint));
      await expect(
        new PostgresAccountStore(db).createPasswordAccount({
          email: account.email,
          displayName: account.displayName,
          passwordHash: 'hash',
        }),
      ).rejects.toMatchObject({ code: 'email_taken' });
      expect(db.transactions).toEqual(['begin', 'rollback']);
    },
  );

  it.each([
    uniqueFailure('credentials_pkey'),
    Object.assign(new Error('connection lost'), { code: '08006' }),
  ])('does not turn unrelated database errors into email conflicts', async (failure) => {
    const db = new RecordingDatabase();
    db.results.push(failure);
    await expect(
      new PostgresAccountStore(db).createPasswordAccount({
        email: account.email,
        displayName: account.displayName,
        passwordHash: 'hash',
      }),
    ).rejects.toBe(failure);
  });

  it('projects an active public account without credential fields', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], []);
    const store = new PostgresAccountStore(db);
    expect(await store.getAccount(account.id)).toEqual(account);
    expect(await store.getAccount('missing')).toBeNull();
    expect(db.calls[0]?.sql).toContain('not suspended');
    expect(db.calls[0]?.sql).not.toContain('password_hash');
  });

  it('normalizes lookup and returns current role and suspension with a nullable password', async () => {
    const db = new RecordingDatabase();
    db.results.push([
      { accountId: account.id, role: 'staff', suspended: true, passwordHash: null },
    ]);
    const found = await new PostgresAccountStore(db).findByEmail(' USER@Example.edu ');
    expect(found).toEqual({
      principal: { accountId: account.id, role: 'staff' },
      suspended: true,
      passwordHash: null,
    });
    expect(db.calls[0]?.values).toEqual(['user@example.edu']);
    expect(db.calls[0]?.sql).toContain('left join credentials');
  });

  it('finds password credentials by account id and returns null for missing accounts', async () => {
    const db = new RecordingDatabase();
    db.results.push(
      [{ accountId: account.id, role: 'user', suspended: false, passwordHash: 'hash' }],
      [],
      [],
    );
    const store = new PostgresAccountStore(db);
    expect(await store.getPasswordAccount(account.id)).toEqual({
      principal: { accountId: account.id, role: 'user' },
      suspended: false,
      passwordHash: 'hash',
    });
    expect(await store.getPasswordAccount('missing')).toBeNull();
    expect(await store.findByEmail('missing@example.edu')).toBeNull();
    expect(db.calls[0]?.values).toEqual([account.id]);
  });

  it('locks an active account before a name-only update without requesting a password', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], [{ ...account, displayName: 'New' }]);
    expect(
      await new PostgresAccountStore(db).updateAccount({
        accountId: account.id,
        patch: { displayName: 'New' },
      }),
    ).toMatchObject({ displayName: 'New' });
    expect(db.calls[0]?.sql).toContain('for update');
    expect(db.calls[0]?.sql).toContain('not suspended');
    expect(db.calls[1]?.values).toEqual([account.id, 'New', null]);
    expect(db.calls.every((call) => call.transaction)).toBe(true);
  });

  it('refuses an email update without a password proof before querying', async () => {
    const db = new RecordingDatabase();
    expect(
      await new PostgresAccountStore(db).updateAccount({
        accountId: account.id,
        patch: { email: 'new@example.edu' },
      }),
    ).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it('locks the account then credential and checks proof before updating email', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], [{ passwordHash: 'verified-hash' }], [account]);
    await new PostgresAccountStore(db).updateAccount({
      accountId: account.id,
      patch: { email: ' NEW@Example.edu ', displayName: 'New' },
      expectedPasswordHash: 'verified-hash',
    });
    expect(db.calls[0]?.sql).toContain('from accounts');
    expect(db.calls[1]?.sql).toContain('from credentials');
    expect(db.calls[1]?.sql).toContain('for update');
    expect(db.calls[2]?.values).toEqual([account.id, 'New', 'new@example.edu']);
  });

  it.each([{ proof: [] }, { proof: [{ passwordHash: 'changed-hash' }] }])(
    'refuses stale or missing credential proof without writing the email',
    async ({ proof }) => {
      const db = new RecordingDatabase();
      db.results.push([account], proof);
      expect(
        await new PostgresAccountStore(db).updateAccount({
          accountId: account.id,
          patch: { email: 'new@example.edu' },
          expectedPasswordHash: 'old-hash',
        }),
      ).toBeNull();
      expect(db.calls).toHaveLength(2);
    },
  );

  it('maps a concurrent email uniqueness failure on update', async () => {
    const db = new RecordingDatabase();
    db.results.push(
      [account],
      [{ passwordHash: 'hash' }],
      uniqueFailure('identity_accounts_email_normalized_key'),
    );
    await expect(
      new PostgresAccountStore(db).updateAccount({
        accountId: account.id,
        patch: { email: 'taken@example.edu' },
        expectedPasswordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(AccountFailure);
    expect(db.transactions).toEqual(['begin', 'rollback']);
  });

  it('returns null/false for missing or suspended accounts without credential writes', async () => {
    const db = new RecordingDatabase();
    db.results.push([], []);
    const store = new PostgresAccountStore(db);
    expect(
      await store.updateAccount({ accountId: account.id, patch: { displayName: 'New' } }),
    ).toBeNull();
    expect(await store.replacePassword(account.id, 'old', 'new')).toBe(false);
    expect(db.calls).toHaveLength(2);
  });

  it('replaces the password with compare-and-set after locking in account-first order', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], [{ passwordHash: 'old' }], [{ id: 'credential-id' }]);
    expect(await new PostgresAccountStore(db).replacePassword(account.id, 'old', 'new')).toBe(true);
    expect(db.calls[0]?.sql).toContain('from accounts');
    expect(db.calls[1]?.sql).toContain('for update');
    expect(db.calls[2]?.values).toEqual([account.id, 'old', 'new']);
    expect(db.calls[2]?.sql).toContain('password_hash = $2');
    expect(db.calls.every((call) => call.transaction)).toBe(true);
  });

  it.each([{ proof: [] }, { proof: [{ passwordHash: 'newer' }] }])(
    'does not overwrite a changed password',
    async ({ proof }) => {
      const db = new RecordingDatabase();
      db.results.push([account], proof);
      expect(await new PostgresAccountStore(db).replacePassword(account.id, 'old', 'new')).toBe(
        false,
      );
      expect(db.calls).toHaveLength(2);
    },
  );

  it('handles a defensive empty UPDATE RETURNING result', async () => {
    const db = new RecordingDatabase();
    db.results.push([account], [], [account], [{ passwordHash: 'old' }], []);
    const store = new PostgresAccountStore(db);
    expect(
      await store.updateAccount({ accountId: account.id, patch: { displayName: 'New' } }),
    ).toBeNull();
    expect(await store.replacePassword(account.id, 'old', 'new')).toBe(false);
  });
});

describe('identity: PostgreSQL session query contract', () => {
  it('inserts only the hashed token with explicit timestamps', async () => {
    const db = new RecordingDatabase();
    db.results.push([]);
    await new PostgresAuthSessionStore(db).insert({
      accountId: account.id,
      tokenHash: 'a'.repeat(64),
      createdAt: 1000,
      expiresAt: 2000,
    });
    expect(db.calls[0]?.values).toEqual([account.id, 'a'.repeat(64), 1000, 2000]);
    expect(db.calls[0]?.sql).toContain('token_hash');
  });

  it('joins live accounts rather than storing role or suspension in a session', async () => {
    const db = new RecordingDatabase();
    db.results.push(
      [{ accountId: account.id, role: 'staff', suspended: true, expiresAt: 2000 }],
      [],
    );
    const store = new PostgresAuthSessionStore(db);
    expect(await store.findByTokenHash('hash')).toEqual({
      principal: { accountId: account.id, role: 'staff' },
      suspended: true,
      expiresAt: 2000,
    });
    expect(await store.findByTokenHash('missing')).toBeNull();
    expect(db.calls[0]?.sql).toContain('join accounts');
    expect(db.calls[0]?.values).toEqual(['hash']);
  });

  it('deletes one hash or all sessions for exactly the supplied account', async () => {
    const db = new RecordingDatabase();
    db.results.push([], []);
    const store = new PostgresAuthSessionStore(db);
    await store.deleteByTokenHash('hash');
    await store.deleteByAccountId(account.id);
    expect(db.calls[0]?.sql).toContain('where token_hash = $1');
    expect(db.calls[0]?.values).toEqual(['hash']);
    expect(db.calls[1]?.sql).toContain('where account_id = $1');
    expect(db.calls[1]?.values).toEqual([account.id]);
  });

  it('does not hide session storage outages as invalid credentials', async () => {
    const db = new RecordingDatabase();
    const failure = new Error('connection lost');
    db.results.push(failure);
    await expect(new PostgresAuthSessionStore(db).findByTokenHash('hash')).rejects.toBe(failure);
  });
});
