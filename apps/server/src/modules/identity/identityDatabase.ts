/** A parameterized PostgreSQL query on a pool or a transaction connection. */
export interface IdentitySql {
  query<Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]>;
}

/**
 * Supplied by core, never implemented with a private identity connection pool.
 * Each callback runs on one connection at READ COMMITTED isolation or stronger.
 * Commit only after success, roll back on any rejection, and always release the
 * connection. Reject the promise if COMMIT fails; never report success early.
 * A pg adapter returns result.rows and copies readonly values with [...values].
 */
export interface IdentityDatabase extends IdentitySql {
  withTransaction<T>(work: (transaction: IdentitySql) => Promise<T>): Promise<T>;
}
