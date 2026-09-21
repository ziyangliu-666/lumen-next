import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';

/** Structural subset of pg; the composition root owns the actual dependency/pool. */
export interface IdentityPgConnection {
  query<Row extends object>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  release(destroy?: boolean): void;
}
export interface IdentityPgPool {
  query<Row extends object>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  connect(): Promise<IdentityPgConnection>;
}
function connectionSql(connection: Pick<IdentityPgPool, 'query'>): IdentitySql {
  return {
    query: async <Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]> =>
      (await connection.query<Row>(text, [...values])).rows,
  };
}

/** Reuses core's pool; never creates/closes a pool or runs migrations. */
export function postgresDatabase(pool: IdentityPgPool): IdentityDatabase {
  return {
    ...connectionSql(pool),
    async withTransaction<T>(work: (sql: IdentitySql) => Promise<T>): Promise<T> {
      const connection = await pool.connect();
      let destroy = false;
      try {
        await connection.query('BEGIN');
        const sql = connectionSql(connection);
        let queryFailed = false;
        let firstFailure: unknown;
        const result = await work({
          async query<Row extends object>(
            text: string,
            values: readonly unknown[],
          ): Promise<Row[]> {
            try {
              return await sql.query<Row>(text, values);
            } catch (error) {
              if (!queryFailed) firstFailure = error;
              queryFailed = true;
              throw error;
            }
          },
        });
        // PostgreSQL can answer COMMIT with ROLLBACK after a caught SQL error.
        // This adapter is rollback-only after any query failure (no savepoint recovery).
        if (queryFailed) throw firstFailure;
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await connection.query('ROLLBACK');
        } catch (rollbackError) {
          destroy = true;
          throw new AggregateError(
            [error, rollbackError],
            'Identity transaction and rollback failed',
          );
        }
        throw error;
      } finally {
        connection.release(destroy);
      }
    },
  };
}
