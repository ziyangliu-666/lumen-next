import type { Money } from '@lumen/contracts';
import type { Db } from '../../core/db/db.js';
import type {
  BudgetApprovalResume,
  Charge,
  CheckPoint,
  Decision,
} from '../../core/domain/budget.js';
import { badRequest, HttpError, notFound } from '../../core/http/httpError.js';
import { money, UUID } from './validation.js';

export interface Approval {
  id: string;
  taskId: string;
  attemptId: string;
  checkpoint: CheckPoint;
  estimate: Money;
  unknownCost: boolean;
  reason: string;
  status: 'pending' | 'consumed' | 'rejected';
  resumePending: boolean;
}
interface ApprovalRow {
  id: string;
  task_id: string;
  attempt_id: string;
  checkpoint: CheckPoint;
  amount: number;
  unknown_cost: boolean;
  reason: string;
  status: Approval['status'];
  resume_pending: boolean;
}
function view(row: ApprovalRow): Approval {
  return {
    id: row.id,
    taskId: row.task_id,
    attemptId: row.attempt_id,
    checkpoint: row.checkpoint,
    estimate: { dollars: row.amount },
    unknownCost: row.unknown_cost,
    reason: row.reason,
    status: row.status,
    resumePending: row.resume_pending,
  };
}

/** Billing owns these rows; the core resume port owns session state. */
export class Approvals {
  constructor(
    private readonly db: Db,
    private readonly resume: BudgetApprovalResume,
  ) {}

  async check(charge: Charge): Promise<Decision | null> {
    money(charge.estimate);
    const [row] = await this.db.query<ApprovalRow & { matches: boolean }>(
      `select *, ((task_id = $3::uuid and checkpoint = $4 and amount = $5::numeric)
        or (checkpoint = 'fan-out' and $4 = 'task-open')) as matches
       from billing_approvals where account_id = $1 and attempt_id = $2`,
      [charge.accountId, charge.attemptId, charge.taskId, charge.at, charge.estimate.dollars],
    );
    if (!row) return null;
    if (!row.matches) return { kind: 'deny', reason: 'approval does not match this operation' };
    if (row.status === 'consumed') return { kind: 'allow' };
    if (row.status === 'rejected') return { kind: 'deny', reason: 'approval rejected' };
    return { kind: 'escalate', approvalId: row.id };
  }

  async request(charge: Charge): Promise<Decision> {
    money(charge.estimate);
    if (
      !charge.accountId.trim() ||
      !UUID.test(charge.taskId) ||
      !UUID.test(charge.attemptId) ||
      !charge.reason.trim() ||
      charge.reason.length > 2000
    )
      throw badRequest('invalid approval request');
    await this.db.query(
      `insert into billing_approvals
      (account_id, task_id, attempt_id, checkpoint, amount, reason) values ($1,$2,$3,$4,$5,$6)
      on conflict (account_id, attempt_id) do nothing`,
      [
        charge.accountId,
        charge.taskId,
        charge.attemptId,
        charge.at,
        charge.estimate.dollars,
        charge.reason,
      ],
    );
    return (await this.check(charge))!;
  }

  async list(accountId: string): Promise<Approval[]> {
    const rows = await this.db.query<ApprovalRow>(
      `select *, amount = 0 as unknown_cost from billing_approvals
      where account_id = $1 order by (status = 'pending') desc, created_at desc, id desc limit 100`,
      [accountId],
    );
    return rows.map(view);
  }

  /** A grant is consumed once here, before session rechecks the durable attempt (#62). */
  async decide(accountId: string, id: string, action: 'grant' | 'reject'): Promise<Approval> {
    if (!UUID.test(id)) throw badRequest('invalid approval id');
    return this.db.withTransaction(async (tx) => {
      const [row] = await tx.query<ApprovalRow>(
        'select *, amount = 0 as unknown_cost from billing_approvals where id = $1 and account_id = $2 for update',
        [id, accountId],
      );
      if (!row) throw notFound('approval is unavailable');
      const status = action === 'grant' ? 'consumed' : 'rejected';
      if (row.status !== 'pending') {
        if (row.status !== status) throw new HttpError(409, 'approval already decided');
        return view(row);
      }
      const [updated] = await tx.query<ApprovalRow>(
        `update billing_approvals
        set status = $3, decided_at = now(), resume_pending = true, resume_after = now()
        where id = $1 and account_id = $2 and status = 'pending' returning *, amount = 0 as unknown_cost`,
        [id, accountId, status],
      );
      return view(updated!);
    });
  }

  /** Durable delivery; a crashed dispatcher releases its lease after 30 seconds. */
  async deliver(): Promise<void> {
    const rows = await this.db.query<{ id: string; account_id: string }>(`with ready as (
      select id from billing_approvals where resume_pending and resume_after <= now()
      order by resume_after limit 20 for update skip locked
    ) update billing_approvals a set resume_after = now() + interval '30 seconds'
      from ready where a.id = ready.id returning a.id, a.account_id`);
    for (const row of rows) {
      try {
        await this.resume.requestResume({ accountId: row.account_id, approvalId: row.id });
      } catch (error) {
        // #62 makes duplicate, missing and foreign resume IDs a terminal 404.
        if (!(error instanceof HttpError && error.status === 404)) continue;
      }
      await this.db.query('update billing_approvals set resume_pending = false where id = $1', [
        row.id,
      ]);
    }
  }
}
