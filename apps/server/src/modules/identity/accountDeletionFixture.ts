import type { IdentityDatabase } from './identityDatabase.js';

/** Test-only DDL for a disposable schema, NOT an approved production migration. */
export async function withTestRetentionConstraints<T>(
  database: IdentityDatabase,
  work: () => Promise<T>,
  deletion: 'restrict' | 'cascade' = 'restrict',
): Promise<T> {
  await database.withTransaction(async (sql) => {
    for (const table of ['sessions', 'ledger_entries']) {
      await sql.query(
        `alter table ${table} alter column account_id type uuid using account_id::uuid`,
        [],
      );
      await sql.query(
        `alter table ${table} add constraint identity_test_retention
         foreign key (account_id) references accounts(id) on delete ${deletion}`,
        [],
      );
    }
  });
  try {
    return await work();
  } finally {
    await database.withTransaction(async (sql) => {
      for (const table of ['sessions', 'ledger_entries']) {
        await sql.query(`alter table ${table} drop constraint identity_test_retention`, []);
        await sql.query(
          `alter table ${table} alter column account_id type text using account_id::text`,
          [],
        );
      }
    });
  }
}
