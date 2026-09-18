import { describe, expect, it, vi } from 'vitest';
import { AccountDeletion } from './accountDeletion.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type * as PasswordHash from './passwordHash.js';

// Proof validation has separate real-hash coverage. These default-CI tests
// exercise the fail-closed write ordering without optional database tooling.
vi.mock('./passwordHash.js', async (importOriginal) => {
  const actual = await importOriginal<typeof PasswordHash>();
  return { ...actual, verifyPassword: vi.fn().mockResolvedValue(true) };
});

function fixture(retention: object[]): {
  database: IdentityDatabase;
  statements: string[];
} {
  const statements: string[] = [];
  const sql: IdentitySql = {
    query<Row extends object>(text: string): Promise<Row[]> {
      statements.push(text);
      let rows: object[] = [];
      if (text.startsWith('select id from accounts')) rows = [{ id: 'account' }];
      else if (text.startsWith('select password_hash')) rows = [{ passwordHash: 'proof-hash' }];
      else if (text.includes('pg_constraint')) rows = retention;
      return Promise.resolve(rows as Row[]);
    },
  };
  return {
    statements,
    database: {
      query: <Row extends object>(): Promise<Row[]> =>
        Promise.resolve([
          {
            accountId: 'account',
            role: 'user',
            suspended: false,
            passwordHash: 'proof-hash',
          },
        ] as unknown as Row[]),
      withTransaction: (work) => work(sql),
    },
  };
}

describe('identity: account deletion retention gate', () => {
  it.each([{ rows: [] }, { rows: [{ protected: false }] }, { rows: [{ protected: 'true' }] }])(
    'refuses deletion unless the database proves restrictive retention',
    async ({ rows }) => {
      const { database, statements } = fixture(rows);
      await expect(
        new AccountDeletion(database).remove('account', {
          currentPassword: 'synthetic password proof',
        }),
      ).rejects.toMatchObject({ code: 'account_in_use' });
      expect(statements[0]).toBe('lock table accounts in share row exclusive mode');
      expect(statements.some((text) => text.includes('pg_constraint'))).toBe(true);
      expect(statements.some((text) => /^(delete|update|insert)/i.test(text))).toBe(false);
    },
  );

  it('deletes identity records only after the retention check succeeds', async () => {
    const { database, statements } = fixture([{ protected: true }]);
    await new AccountDeletion(database).remove('account', {
      currentPassword: 'synthetic password proof',
    });
    const check = statements.findIndex((text) => text.includes('pg_constraint'));
    const writes = statements.filter((text) => text.startsWith('delete'));
    expect(writes).toEqual([
      'delete from auth_sessions where account_id = $1',
      'delete from credentials where account_id = $1',
      'delete from accounts where id = $1',
    ]);
    expect(statements.indexOf(writes[0]!)).toBeGreaterThan(check);
    expect(check).toBeGreaterThan(0);
  });
});
