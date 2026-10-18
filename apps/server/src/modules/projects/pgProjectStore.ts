import type { Db } from '../../core/db/db.js';
import type { Finding, PageRequest, Project } from './models.js';
import type { ProjectStore } from './ports.js';

// Writes supply millisecond timestamps, matching cursor and wire precision.
const PROJECT =
  'id, account_id as "accountId", title, mode, (extract(epoch from created_at) * 1000)::float8 as "createdAt", (extract(epoch from last_opened_at) * 1000)::float8 as "lastOpenedAt", spend_at_visit as "spendAtVisit"';
const FINDING =
  'id, session_id as "sessionId", task_id as "taskId", text, (extract(epoch from created_at) * 1000)::float8 as "createdAt"';
const AFTER = '($2::timestamptz is null or (created_at, id) < ($2::timestamptz, $3::uuid))';
function params(scope: string, page: PageRequest): readonly unknown[] {
  return [
    scope,
    page.after ? new Date(page.after.createdAt) : null,
    page.after?.id ?? null,
    page.limit + 1,
  ];
}
export class PgProjectStore implements ProjectStore {
  constructor(private readonly db: Db) {}
  async insert(project: Project): Promise<void> {
    await this.db.query(
      'insert into projects (id, account_id, title, mode, created_at, last_opened_at, spend_at_visit) values ($1, $2, $3, $4, $5, $6, $7)',
      [
        project.id,
        project.accountId,
        project.title,
        project.mode,
        new Date(project.createdAt),
        project.lastOpenedAt === null ? null : new Date(project.lastOpenedAt),
        project.spendAtVisit,
      ],
    );
  }
  async retitle(id: string, title: string, source: 'model' | 'person'): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `update projects set title = $2, title_source = $3
        where id = $1 and ($3 = 'person' or title_source = 'question') returning id`,
      [id, title, source],
    );
    return rows.length > 0;
  }
  async remove(id: string): Promise<void> {
    await this.db.query('delete from projects where id = $1', [id]);
  }
  async get(id: string): Promise<Project | null> {
    const rows = await this.db.query<Project & Record<string, unknown>>(
      `select ${PROJECT} from projects where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }
  list(accountId: string, page: PageRequest): Promise<Project[]> {
    return this.db.query<Project & Record<string, unknown>>(
      `select ${PROJECT} from projects where account_id = $1 and ${AFTER} order by created_at desc, id desc limit $4`,
      params(accountId, page),
    );
  }
  async saveFinding(projectId: string, finding: Finding): Promise<void> {
    await this.db.query(
      'insert into findings (id, project_id, session_id, task_id, text, created_at) values ($1, $2, $3, $4, $5, $6)',
      [
        finding.id,
        projectId,
        finding.sessionId,
        finding.taskId,
        finding.text,
        new Date(finding.createdAt),
      ],
    );
  }
  async visit(id: string, accountId: string, at: number, spend: number): Promise<Project | null> {
    const rows = await this.db.query<Project>(
      `update projects set
        spend_at_visit = case when last_opened_at is null or last_opened_at <= $3 then greatest(spend_at_visit, $4::numeric) else spend_at_visit end,
        last_opened_at = greatest(created_at, last_opened_at, $3::timestamptz)
       where id = $1 and account_id = $2 returning ${PROJECT}`,
      [id, accountId, new Date(at), spend],
    );
    return rows[0] ?? null;
  }
  findings(projectId: string, page: PageRequest): Promise<Finding[]> {
    return this.db.query<Finding & Record<string, unknown>>(
      `select ${FINDING} from findings where project_id = $1 and ${AFTER} order by created_at desc, id desc limit $4`,
      params(projectId, page),
    );
  }
  sessionFindings(sessionId: string): Promise<Finding[]> {
    return this.db.query<Finding & Record<string, unknown>>(
      `select ${FINDING} from findings where session_id = $1 order by created_at, id`,
      [sessionId],
    );
  }
  async findingStats(
    projectId: string,
    since?: number,
  ): Promise<{ count: number; lastAt: number | null; added: number }> {
    const [row] = await this.db.query<{ count: number; lastAt: number | null; added: number }>(
      'select count(*)::int as count, count(*) filter (where $2::timestamptz is null or created_at > $2)::int as added, (extract(epoch from max(created_at)) * 1000)::float8 as "lastAt" from findings where project_id = $1',
      [projectId, since === undefined ? null : new Date(since)],
    );
    return row!;
  }
}
