import type { Finding, PageRequest, Project } from './models.js';
import type { ProjectStore } from './ports.js';
import { afterPosition, newest } from './validation.js';

/** Development and tests only; use PgProjectStore for durable records. */
export class MemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, Project>();
  private readonly records = new Map<string, Finding & { projectId: string }>();

  insert(project: Project): Promise<void> {
    if (this.projects.has(project.id)) return Promise.reject(new Error('Duplicate project.'));
    this.projects.set(project.id, { ...project });
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    if ([...this.records.values()].some((finding) => finding.projectId === id))
      return Promise.reject(new Error('Project has findings.'));
    this.projects.delete(id);
    return Promise.resolve();
  }
  get(id: string): Promise<Project | null> {
    const project = this.projects.get(id);
    return Promise.resolve(project ? { ...project } : null);
  }
  list(accountId: string, page: PageRequest): Promise<Project[]> {
    return Promise.resolve(
      [...this.projects.values()]
        .filter((p) => p.accountId === accountId && afterPosition(p, page.after))
        .sort(newest)
        .slice(0, page.limit + 1)
        .map((p) => ({ ...p })),
    );
  }
  visit(id: string, accountId: string, at: number, spend: number): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project || project.accountId !== accountId) return Promise.resolve(null);
    if (project.lastOpenedAt === null || at >= project.lastOpenedAt) {
      this.projects.set(id, {
        ...project,
        lastOpenedAt: Math.max(project.createdAt, at),
        spendAtVisit: Math.max(project.spendAtVisit, spend),
      });
    }
    return this.get(id);
  }
  saveFinding(projectId: string, finding: Finding): Promise<void> {
    if (!this.projects.has(projectId) || this.records.has(finding.id))
      return Promise.reject(new Error('Invalid finding.'));
    this.records.set(finding.id, { ...finding, projectId });
    return Promise.resolve();
  }
  findings(projectId: string, page: PageRequest): Promise<Finding[]> {
    return Promise.resolve(
      [...this.records.values()]
        .filter((f) => f.projectId === projectId && afterPosition(f, page.after))
        .sort(newest)
        .slice(0, page.limit + 1)
        .map(({ projectId: _projectId, ...f }) => f),
    );
  }
  sessionFindings(sessionId: string): Promise<Finding[]> {
    return Promise.resolve(
      [...this.records.values()]
        .filter((f) => f.sessionId === sessionId)
        .sort((a, b) => -newest(a, b))
        .map(({ projectId: _projectId, ...f }) => f),
    );
  }
  findingStats(
    projectId: string,
    since = -Infinity,
  ): Promise<{ count: number; lastAt: number | null; added: number }> {
    const findings = [...this.records.values()].filter((f) => f.projectId === projectId);
    return Promise.resolve({
      count: findings.length,
      added: findings.filter((finding) => finding.createdAt > since).length,
      lastAt: findings.length ? Math.max(...findings.map((f) => f.createdAt)) : null,
    });
  }
}
