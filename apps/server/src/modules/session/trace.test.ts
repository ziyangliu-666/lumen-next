import { afterAll, beforeAll, describe } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { MemoryTrace } from './memoryTrace.js';
import { PgTrace } from './pgTrace.js';
import { traceContract } from './traceContract.js';

describe('session: trace in memory', () => {
  traceContract(() => new MemoryTrace());
});

describe.skipIf(!TEST_DATABASE_URL)('session: trace in Postgres', () => {
  let db: Db;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await openTestDb());
  });
  afterAll(() => drop());

  traceContract(() => new PgTrace(db));
});
