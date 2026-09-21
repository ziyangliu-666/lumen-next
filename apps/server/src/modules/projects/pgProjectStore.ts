import type { Db } from '../../core/db/db.js';
import type { Finding, PageRequest, Project } from './models.js';
import type { ProjectStore } from './ports.js';

// Writes supply millisecond timestamps, matching cursor and wire precision.
const PROJECT =
  'id, account_id as "accountId", title, mode, (extract(epoch from created_at) * 1000)::float8 as "createdAt"';
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
      'insert into projects (id, account_id, title, mode, created_at) values ($1, $2, $3, $4, $5)',
      [project.id, project.accountId, project.title, project.mode, new Date(project.createdAt)],
    );
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
  async findingStats(projectId: string): Promise<{ count: number; lastAt: number | null }> {
    const [row] = await this.db.query<{ count: number; lastAt: number | null }>(
      'select count(*)::int as count, (extract(epoch from max(created_at)) * 1000)::float8 as "lastAt" from findings where project_id = $1',
      [projectId],
    );
    return row!;
  }
}
