import { randomUUID } from 'node:crypto';
import type {
  Money,
  Session,
  SessionMode,
  SessionSummary,
  Step,
  StepKind,
  TaskStatus,
} from '@lumen/contracts';
import type { Db, Queryable } from '../../core/db/db.js';
import type { TaskRecord } from '../../core/domain/task.js';
import { isEnding, type Trace, type TraceSnapshot } from './trace.js';

// The record in Postgres. Every task and every step is written as it happens,
// so a process that dies loses nothing, and the snapshot is a read of the same
// rows the events described.
//
// Ids are made here, not by the database default, so that the row and the
// event that announces it carry the same id without a round trip to read it.

interface SessionRow {
  id: string;
  mode: SessionMode;
  project_id: string;
  account_id: string;
  started_at: Date;
  [column: string]: unknown;
}

interface TaskRow {
  id: string;
  session_id: string;
  parent_id: string | null;
  agent: string;
  title: string;
  depth: number;
  status: TaskStatus;
  own_cost: number;
  started_at: Date;
  ended_at: Date | null;
  child_ids: string[];
  [column: string]: unknown;
}

interface StepRow {
  task_id: string;
  index: number;
  kind: StepKind;
  text: string;
  [column: string]: unknown;
}

// child_ids is read, never stored: the parent_id column is the one truth about
// the tree, and an array kept beside it would be a second one to keep in step.
const TASK_COLUMNS = `
  t.id, t.session_id, t.parent_id, t.agent, t.title, t.depth, t.status, t.own_cost,
  t.started_at, t.ended_at,
  coalesce(
    (select array_agg(c.id order by c.seq) from tasks c where c.parent_id = t.id),
    '{}'
  ) as child_ids`;

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    mode: row.mode,
    projectId: row.project_id,
    accountId: row.account_id,
    startedAt: row.started_at.getTime(),
  };
}

function toStep(row: StepRow): Step {
  return { taskId: row.task_id, index: row.index, kind: row.kind, text: row.text };
}

function toTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    parentId: row.parent_id,
    agent: row.agent,
    title: row.title,
    depth: row.depth,
    status: row.status,
    ownCost: { dollars: row.own_cost },
    startedAt: row.started_at.getTime(),
    endedAt: row.ended_at ? row.ended_at.getTime() : null,
    childIds: row.child_ids,
  };
}

// A session id arrives in a URL, so it can be any string. Postgres refuses to
// compare a uuid column with text that is not a uuid, and that error would
// surface as a 500. An id that cannot be a uuid names nothing: answer "no such
// row" without asking.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PgTrace implements Trace {
  constructor(private readonly db: Db) {}

  async openSession(projectId: string, accountId: string, mode: SessionMode): Promise<Session> {
    const [row] = await this.db.query<SessionRow>(
      `insert into sessions (id, project_id, account_id, mode) values ($1, $2, $3, $4)
       returning id, mode, project_id, account_id, started_at`,
      [randomUUID(), projectId, accountId, mode],
    );
    return toSession(row!);
  }

  async session(id: string): Promise<Session | null> {
    if (!UUID.test(id)) return null;
    const [row] = await this.db.query<SessionRow>(
      `select id, mode, project_id, account_id, started_at from sessions where id = $1`,
      [id],
    );
    return row ? toSession(row) : null;
  }

  async openTask(
    sessionId: string,
    parentId: string | null,
    agent: string,
    title: string,
  ): Promise<TaskRecord> {
    // The depth comes from the parent row in the same statement, so a child
    // can never be written with a depth its parent does not justify.
    const id = randomUUID();
    if (parentId === null) {
      await this.db.query(
        `insert into tasks (id, session_id, parent_id, agent, title, depth)
         values ($1, $2, null, $3, $4, 0)`,
        [id, sessionId, agent, title],
      );
    } else {
      const inserted = await this.db.query(
        `insert into tasks (id, session_id, parent_id, agent, title, depth)
         select $1, $2, p.id, $4, $5, p.depth + 1 from tasks p where p.id = $3
         returning id`,
        [id, sessionId, UUID.test(parentId) ? parentId : null, agent, title],
      );
      if (inserted.length === 0) throw new Error(`trace: no parent task ${parentId}`);
    }
    return (await this.task(id))!;
  }

  async task(id: string): Promise<TaskRecord | null> {
    if (!UUID.test(id)) return null;
    return this.oneTask(this.db, 'where t.id = $1', [id]);
  }

  async rootOf(sessionId: string): Promise<TaskRecord | null> {
    if (!UUID.test(sessionId)) return null;
    return this.oneTask(this.db, 'where t.session_id = $1 and t.parent_id is null', [sessionId]);
  }

  async setStatus(taskId: string, status: TaskStatus): Promise<TaskRecord> {
    const updated = await this.db.query(
      `update tasks set status = $2, ended_at = case when $3 then now() else null end
        where id = $1 returning id`,
      [UUID.test(taskId) ? taskId : null, status, isEnding(status)],
    );
    if (updated.length === 0) throw new Error(`trace: no task ${taskId}`);
    return (await this.task(taskId))!;
  }

  async appendStep(taskId: string, kind: StepKind, text: string): Promise<Step> {
    if (!UUID.test(taskId)) throw new Error(`trace: no task ${taskId}`);
    // Two reports for one task can arrive together. The index is max + 1, so
    // the two must not read the same max: the row lock on the task makes the
    // second wait for the first to commit.
    return this.db.withTransaction(async (tx) => {
      const locked = await tx.query(`select id from tasks where id = $1 for update`, [taskId]);
      if (locked.length === 0) throw new Error(`trace: no task ${taskId}`);
      const [row] = await tx.query<StepRow>(
        `insert into steps (task_id, index, kind, text)
         select $1, coalesce(max(index) + 1, 0), $2, $3 from steps where task_id = $1
         returning task_id, index, kind, text`,
        [taskId, kind, text],
      );
      return toStep(row!);
    });
  }

  async addCost(taskId: string, amount: Money): Promise<TaskRecord> {
    // The addition happens in SQL, on the numeric column. Reading the cost,
    // adding in JS and writing it back would drift, and would lose one of two
    // spends that arrive together.
    const updated = await this.db.query(
      `update tasks set own_cost = own_cost + $2 where id = $1 returning id`,
      [UUID.test(taskId) ? taskId : null, amount.dollars],
    );
    if (updated.length === 0) throw new Error(`trace: no task ${taskId}`);
    return (await this.task(taskId))!;
  }

  async snapshot(sessionId: string): Promise<TraceSnapshot | null> {
    const session = await this.session(sessionId);
    if (!session) return null;
    const tasks = await this.db.query<TaskRow>(
      `select ${TASK_COLUMNS} from tasks t where t.session_id = $1 order by t.seq`,
      [sessionId],
    );
    const steps = await this.db.query<StepRow>(
      `select s.task_id, s.index, s.kind, s.text from steps s
         join tasks t on t.id = s.task_id
        where t.session_id = $1 order by t.seq, s.index`,
      [sessionId],
    );
    return {
      session,
      tasks: tasks.map(toTask),
      steps: steps.map(toStep),
    };
  }

  async openTasks(): Promise<TaskRecord[]> {
    const rows = await this.db.query<TaskRow>(
      `select ${TASK_COLUMNS} from tasks t
        where t.status in ('queued', 'running', 'waiting') order by t.seq`,
    );
    return rows.map(toTask);
  }

  async summaries(projectId: string): Promise<SessionSummary[]> {
    // One statement, no steps read, and the spend summed on the numeric column.
    const rows = await this.db.query<{
      id: string;
      mode: SessionMode;
      status: TaskStatus | null;
      spend: number;
      started_at: Date;
      ended_at: Date | null;
    }>(
      `select s.id, s.mode, s.started_at, r.status, r.ended_at,
              coalesce((select sum(t.own_cost) from tasks t where t.session_id = s.id), 0) as spend
         from sessions s
         left join tasks r on r.session_id = s.id and r.parent_id is null
        where s.project_id = $1
        order by s.started_at desc, s.id desc`,
      [projectId],
    );
    return rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      status: row.status ?? 'queued',
      spend: { dollars: row.spend },
      startedAt: row.started_at.getTime(),
      endedAt: row.ended_at ? row.ended_at.getTime() : null,
    }));
  }

  private async oneTask(
    from: Queryable,
    where: string,
    params: readonly unknown[],
  ): Promise<TaskRecord | null> {
    const [row] = await from.query<TaskRow>(
      `select ${TASK_COLUMNS} from tasks t ${where} limit 1`,
      params,
    );
    return row ? toTask(row) : null;
  }
}
