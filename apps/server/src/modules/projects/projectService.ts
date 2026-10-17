import { randomUUID } from 'node:crypto';
import { nullLog, type Log } from '../../core/log/log.js';
import type { Principal } from '../../core/http/authGuard.js';
import { badRequest, HttpError, notFound } from '../../core/http/httpError.js';
import type {
  Finding,
  LatestSession,
  Page,
  Project,
  ProjectCard,
  ProjectSummary,
  StopResult,
} from './models.js';
import type { ProjectSessions, ProjectStore } from './ports.js';
import { ProjectCardContext } from './projectCardContext.js';
import { cumulativeSpend, sessionsEndedSince, spendSinceVisit } from './lastVisit.js';
import { creationOf, idOf, pageOf, pageResult, textOf } from './validation.js';

function summary({
  accountId: _accountId,
  lastOpenedAt: _lastOpenedAt,
  spendAtVisit: _spendAtVisit,
  ...project
}: Project): ProjectSummary {
  return project;
}
async function dependency<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new HttpError(503, 'Session service unavailable. Refresh before trying again.');
  }
}

/** Owns UC2 orchestration; execution and authentication stay behind their ports. */
export class ProjectService {
  constructor(
    private readonly store: ProjectStore,
    private readonly sessions: ProjectSessions,
    private readonly log: Log = nullLog,
  ) {}

  async create(
    principal: Principal,
    body: unknown,
  ): Promise<{ project: ProjectSummary; sessionId: string }> {
    const { question, mode } = creationOf(body);
    const project: Project = {
      id: randomUUID(),
      accountId: principal.accountId,
      title: titleOf(question),
      mode,
      createdAt: Date.now(),
      lastOpenedAt: null,
      spendAtVisit: 0,
    };
    await this.store.insert(project);
    try {
      const session = await this.sessions.start(project.id, principal, question, mode);
      this.log.info(
        { projectId: project.id, accountId: principal.accountId, sessionId: session.id },
        'project created',
      );
      return { project: summary(project), sessionId: session.id };
    } catch {
      // A rejected start must not leave a project card. Cleanup errors propagate.
      await this.store.remove(project.id);
      throw new HttpError(503, 'Session service unavailable. Refresh before trying again.');
    }
  }
  async list(principal: Principal, query: unknown): Promise<Page<ProjectCard>> {
    const scope = JSON.stringify(['projects', principal.accountId]);
    const request = pageOf(query, scope);
    const page = pageResult(
      await this.store.list(principal.accountId, request),
      request.limit,
      scope,
    );
    return {
      items: await Promise.all(page.items.map((project) => this.card(principal, project))),
      nextCursor: page.nextCursor,
    };
  }
  async get(principal: Principal, id: string): Promise<ProjectCard> {
    return this.card(principal, await this.owned(principal, id));
  }
  async visit(principal: Principal, id: string): Promise<{ lastOpenedAt: number }> {
    const project = await this.owned(principal, id);
    const at = Math.max(project.createdAt, Date.now());
    const sessions = await dependency(() => this.sessions.list(project.id, principal));
    const saved = await this.store.visit(
      project.id,
      principal.accountId,
      at,
      cumulativeSpend(sessions),
    );
    if (!saved) throw notFound('No such project.');
    this.log.info({ projectId: project.id, accountId: principal.accountId }, 'project visited');
    return { lastOpenedAt: saved.lastOpenedAt! };
  }
  /** Metadata-only owner check for session creation; never calls back into session. */
  async requireProject(principal: Principal, id: string): Promise<ProjectSummary> {
    return summary(await this.owned(principal, id));
  }
  async stop(principal: Principal, id: string): Promise<StopResult> {
    const card = await this.get(principal, id);
    const sessionId = card.latestSession?.id ?? null;
    if (!sessionId) return { projectId: card.project.id, sessionId, outcome: 'no_session' };
    const context = new ProjectCardContext(card.latestSession!);
    const outcome = await context.stop(() =>
      dependency(() => this.sessions.stop(sessionId, principal)),
    );
    return { projectId: card.project.id, sessionId, outcome };
  }
  async findings(principal: Principal, id: string, query: unknown): Promise<Page<Finding>> {
    const project = await this.owned(principal, id);
    const scope = JSON.stringify(['findings', principal.accountId, project.id]);
    const request = pageOf(query, scope);
    return pageResult(await this.store.findings(project.id, request), request.limit, scope);
  }
  async projectOf(sessionId: string): Promise<{ id: string; accountId: string }> {
    const id = idOf(sessionId);
    const context = await dependency(() => this.sessions.context(id));
    if (!context) throw notFound('No such session.');
    const project = await this.store.get(context.projectId);
    if (!project || project.accountId !== context.accountId) throw notFound('No such project.');
    return { id: project.id, accountId: project.accountId };
  }
  async recordFinding(sessionId: string, taskId: string, raw: string): Promise<Finding> {
    const text = textOf(raw, 20000);
    const session = idOf(sessionId);
    const task = idOf(taskId);
    const project = await this.projectOf(session);
    const taskSession = await dependency(() => this.sessions.taskSession(task));
    if (!taskSession) throw notFound('No such task.');
    if (taskSession !== session) throw badRequest('Task does not belong to this session.');
    const finding: Finding = {
      id: randomUUID(),
      sessionId: session,
      taskId: task,
      text,
      createdAt: Date.now(),
    };
    await this.store.saveFinding(project.id, finding);
    // Session publishes exactly once, after this successful durable write.
    return finding;
  }
  async listFindings(sessionId: string): Promise<Finding[]> {
    const id = idOf(sessionId);
    await this.projectOf(id);
    return this.store.sessionFindings(id);
  }
  private async owned(principal: Principal, id: string): Promise<Project> {
    const project = await this.store.get(idOf(id));
    if (!project || project.accountId !== principal.accountId) throw notFound('No such project.');
    return project;
  }
  private async card(principal: Principal, project: Project): Promise<ProjectCard> {
    const sessions = await dependency(() => this.sessions.list(project.id, principal));
    const latest: LatestSession | null =
      [...sessions].sort(
        (a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      )[0] ?? null;
    const since = project.lastOpenedAt ?? project.createdAt - 1;
    const stats = await this.store.findingStats(project.id, since);
    const context = latest ? new ProjectCardContext(latest) : null;
    const descriptor = context?.describe();
    const pollAfterMs = context?.pollDelay() ?? null;
    return {
      lastOpenedAt: project.lastOpenedAt,
      sinceLastVisit: {
        sessionsEnded: sessionsEndedSince(sessions, since),
        findingsAdded: stats.added,
        spend: {
          dollars: spendSinceVisit(cumulativeSpend(sessions), project.spendAtVisit),
        },
      },
      project: summary(project),
      latestSession: latest,
      findingsCount: stats.count,
      lastActivityAt: Math.max(
        project.createdAt,
        stats.lastAt ?? 0,
        ...sessions.map((s) => Math.max(s.startedAt, s.endedAt ?? 0)),
      ),
      label: descriptor?.label ?? 'Awaiting session',
      tone: descriptor?.tone ?? 'muted',
      actions: {
        openSession: latest !== null,
        stopLatestSession: descriptor?.actions.includes('stop') ?? false,
      },
      refreshPolicy: pollAfterMs === null ? 'manual' : 'poll',
      pollAfterMs,
    };
  }
}

/** The longest project title, in characters. */
const TITLE_LIMIT = 120;

/**
 * A project is named by its first question. A long question is cut at the
 * last whole word and marked with an ellipsis: cut at 120 characters, "and
 * save the table" became "and save the t", which read as a typo.
 */
export function titleOf(question: string): string {
  const flat = [...question.replace(/\s+/gu, ' ').trim()];
  if (flat.length <= TITLE_LIMIT) return flat.join('');
  const head = flat.slice(0, TITLE_LIMIT - 1).join('');
  const space = head.lastIndexOf(' ');
  return `${(space > TITLE_LIMIT / 2 ? head.slice(0, space) : head).replace(/[\s,;:.]+$/u, '')}…`;
}
