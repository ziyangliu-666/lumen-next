import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../core/db/db.js';
import { openTestDb, TEST_DATABASE_URL } from '../../core/db/testDb.js';
import { Broker } from '../../core/protocol/broker.js';
import { Kernel } from './kernel.js';
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

  it('rolls the step back with the charge when the ledger refuses it', async () => {
    const trace = new PgTrace(db, () => Promise.reject(new Error('ledger refused')));
    const session = await trace.openSession('p1', 'acc-1', 'explore');
    const root = await trace.openTask(session.id, null, 'lead', 'q');

    await expect(
      trace.appendCostedStep(
        root.id,
        'tool',
        'search: x',
        { tool: 'search' },
        {
          amount: { dollars: 0.01 },
          reason: 'search',
        },
      ),
    ).rejects.toThrow('ledger refused');

    const after = await trace.snapshot(session.id);
    expect(after?.steps).toEqual([]);
    expect(after?.tasks[0]?.ownCost).toEqual({ dollars: 0 });
  });

  it('takes, through the kernel, the output a real process can print', async () => {
    const kernel = new Kernel(new PgTrace(db), new Broker(), { run: () => Promise.resolve() });
    const owner = { accountId: 'acc-1', role: 'user' as const };
    const { session, tasks } = await kernel.start('p1', owner.accountId, 'q');
    await kernel.idle();
    const nul = String.fromCharCode(0);
    const half = '😀'.slice(0, 1);

    // Either of these, written as given, makes the jsonb insert throw.
    await kernel.appendStep(tasks[0]!.id, 'tool', 'run: binary', { output: `a${nul}b ${half}` });

    const step = (await kernel.snapshot(session.id, owner)).steps.at(-1);
    expect(step?.detail?.output).toBe('ab \uFFFD');
  });
});
