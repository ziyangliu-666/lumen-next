import { describe, expect, it, vi } from 'vitest';
import {
  postgresDatabase,
  type IdentityPgConnection,
  type IdentityPgPool,
} from './postgresDatabase.js';

function setup(failAt: readonly string[] = []): {
  pool: IdentityPgPool;
  events: string[];
  release: ReturnType<typeof vi.fn>;
  parameters: unknown[][];
} {
  const events: string[] = [];
  const parameters: unknown[][] = [];
  const release = vi.fn();
  const connection: IdentityPgConnection = {
    query: <Row extends object>(text: string, values: unknown[] = []): Promise<{ rows: Row[] }> => {
      events.push(text);
      parameters.push(values);
      if (failAt.includes(text)) return Promise.reject(new Error(`failed ${text}`));
      return Promise.resolve({ rows: [] });
    },
    release,
  };
  const pool: IdentityPgPool = {
    query: <Row extends object>(
      _text: string,
      values: unknown[] = [],
    ): Promise<{ rows: Row[] }> => {
      events.push('pool query');
      parameters.push(values);
      return Promise.resolve({ rows: [] });
    },
    connect: () => {
      events.push('connect');
      return Promise.resolve(connection);
    },
  };
  return { pool, events, release, parameters };
}

describe('identity: shared PostgreSQL pool adapter', () => {
  it('copies readonly parameters and returns pool result rows', async () => {
    const fixture = setup();
    const values = Object.freeze(['value']);
    expect(await postgresDatabase(fixture.pool).query('select $1', values)).toEqual([]);
    expect(fixture.parameters[0]).toEqual(values);
    expect(fixture.parameters[0]).not.toBe(values);
    expect(fixture.events).toEqual(['pool query']);
  });
  it('runs all transaction work on one client, commits, then releases', async () => {
    const fixture = setup();
    const result = await postgresDatabase(fixture.pool).withTransaction(async (sql) => {
      await sql.query('first', []);
      await sql.query('second', []);
      return 'done';
    });
    expect(result).toBe('done');
    expect(fixture.events).toEqual(['connect', 'BEGIN', 'first', 'second', 'COMMIT']);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.release).toHaveBeenCalledWith(false);
  });
  it.each(['BEGIN', 'work', 'COMMIT'])(
    'rolls back and does not report success when %s fails',
    async (statement) => {
      const fixture = setup([statement]);
      await expect(
        postgresDatabase(fixture.pool).withTransaction((sql) => sql.query('work', [])),
      ).rejects.toThrow(`failed ${statement}`);
      expect(fixture.events.at(-1)).toBe('ROLLBACK');
      expect(fixture.release).toHaveBeenCalledOnce();
      expect(fixture.release).toHaveBeenCalledWith(false);
    },
  );
  it('preserves failures and discards a connection whose rollback also fails', async () => {
    const fixture = setup(['work', 'ROLLBACK']);
    await expect(
      postgresDatabase(fixture.pool).withTransaction((sql) => sql.query('work', [])),
    ).rejects.toBeInstanceOf(AggregateError);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.release).toHaveBeenCalledWith(true);
  });
  it('rolls back when a callback catches a failed SQL statement instead of reporting success', async () => {
    const fixture = setup(['invalid statement']);
    await expect(
      postgresDatabase(fixture.pool).withTransaction(async (sql) => {
        await sql.query('first write', []);
        try {
          await sql.query('invalid statement', []);
        } catch {
          // PostgreSQL remains aborted even if application code catches the error.
        }
        return 'must not escape as a successful result';
      }),
    ).rejects.toThrow('failed invalid statement');
    expect(fixture.events).toEqual([
      'connect',
      'BEGIN',
      'first write',
      'invalid statement',
      'ROLLBACK',
    ]);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.release).toHaveBeenCalledWith(false);
  });

  it('preserves the original query failure object after a callback catches it', async () => {
    const fixture = setup();
    const failure = new Error('original SQL failure');
    const originalConnect = fixture.pool.connect.bind(fixture.pool);
    fixture.pool.connect = async () => {
      const connection = await originalConnect();
      const originalQuery = connection.query.bind(connection);
      connection.query = (text, values) =>
        text === 'bad' ? Promise.reject(failure) : originalQuery(text, values);
      return connection;
    };
    await expect(
      postgresDatabase(fixture.pool).withTransaction(async (sql) => {
        await sql.query('bad', []).catch(() => undefined);
        return 'ignored';
      }),
    ).rejects.toBe(failure);
  });

  it('propagates pool acquisition failure without pretending a connection exists', async () => {
    const fixture = setup();
    const failure = new Error('pool unavailable');
    fixture.pool.connect = () => Promise.reject(failure);
    await expect(
      postgresDatabase(fixture.pool).withTransaction(() => Promise.resolve('done')),
    ).rejects.toBe(failure);
    expect(fixture.release).not.toHaveBeenCalled();
  });
});
