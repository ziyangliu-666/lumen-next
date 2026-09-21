import type { Money } from '@lumen/contracts';
import type { Queryable } from '../../core/db/db.js';

/** Billing writes through the same transaction as the task's cost. */
export type SpendRecorder = (
  entry: {
    readonly accountId: string;
    readonly taskId: string;
    readonly amount: Money;
    readonly reason: string;
  },
  tx: Queryable,
) => Promise<void>;
