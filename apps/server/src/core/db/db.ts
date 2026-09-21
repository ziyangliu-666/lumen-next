import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import pg from 'pg';

// The one database connection for the whole monolith. A slice never builds its
// own pool and never imports `pg`: it is handed a Db and writes SQL against
// it. That keeps the pool size one number, and keeps the domain code free of
// the driver, which is the maintainability rule in the proposal.

/** One row, as the driver returns it. The caller names the columns it reads. */
export type Row = Record<string, unknown>;

export interface Queryable {
  query<T extends Row = Row>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /**
   * Run `work` inside one transaction. It commits when `work` resolves and
   * rolls back when it throws; the error reaches the caller either way. Use
   * the Queryable that is passed in: a query on the outer Db runs on another
   * connection, outside the transaction.
   */
  withTransaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Where the numbered .sql files live, next to this module in src and in dist. */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

// numeric comes back as a string by default, because a JS number cannot hold
// every numeric. Ours is numeric(12,6) dollars, which a double holds exactly
// enough for display, and the contract carries money as a number. Parsing it
// here, once, means no slice writes Number(row.own_cost) and none forgets to.
const NUMERIC_OID = 1700;
pg.types.setTypeParser(NUMERIC_OID, (value) => Number(value));

/** The part of a pool and of a pooled client that this module uses. */
interface Runs {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

function wrap(client: Runs): Queryable {
  return {
    async query<T extends Row = Row>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      const result = await client.query(sql, [...params]);
      return result.rows as T[];
    },
  };
}

export interface OpenOptions {
  /** Skip the migrations. Only a test that checks the runner itself wants this. */
  readonly migrate?: boolean;
  /** Schema to work in. Tests use one each, so they can run side by side. */
  readonly schema?: string;
}

/**
 * Connect, bring the schema up to date, and hand back the Db.
 *
 * node-pg-migrate owns the applied-migrations table, the advisory lock that
 * stops two processes racing at startup, and the transaction around each file.
 * We do not write a migration runner.
 */
export async function openDatabase(url: string, options: OpenOptions = {}): Promise<Db> {
  const schema = options.schema ?? 'public';
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    // Every connection works in the one schema, so SQL never names it.
    options: `-c search_path=${schema}`,
  });
  // A pooled connection that dies while idle emits here. Without a listener
  // that is an unhandled 'error' event, and it takes the process down.
  pool.on('error', (error) => console.error('db: idle connection failed', error));

  if (options.migrate !== false) {
    await runner({
      databaseUrl: url,
      dir: MIGRATIONS_DIR,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      schema,
      createSchema: true,
      // Concurrent application starts and isolated test schemas share the
      // runner's advisory lock. Queue migrations instead of failing startup.
      advisoryLockMode: 'wait',
      // Five slices add migrations on five branches, and they merge in whatever
      // order review allows. With the order check on, a file numbered below one
      // that is already applied stops the process at startup, so every merge
      // would force the others to renumber. Off, it is applied like any other
      // new file. The number names a file; it is not a promise about history.
      // This is safe because a slice migrates its own tables: two files from
      // two slices do not depend on which ran first.
      checkOrder: false,
      log: () => {},
    });
  }

  return {
    ...wrap(pool),
    async withTransaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await work(wrap(client));
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
