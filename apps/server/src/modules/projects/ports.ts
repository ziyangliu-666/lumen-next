import type { Principal } from '../../core/http/authGuard.js';
import type { Finding, LatestSession, PageRequest, Project, ProjectMode } from './models.js';

/** The session owner supplies this through its public index at composition time. */
export interface ProjectSessions {
  start(
    this: void,
    projectId: string,
    principal: Principal,
    question: string,
    mode: ProjectMode,
  ): Promise<{ id: string }>;
  list(this: void, projectId: string, principal: Principal): Promise<readonly LatestSession[]>;
  stop(this: void, sessionId: string, principal: Principal): Promise<void>;
  /** Trusted metadata lookup: must not call projects.projectOf recursively. */
  context(this: void, sessionId: string): Promise<{ projectId: string; accountId: string } | null>;
  taskSession(this: void, taskId: string): Promise<string | null>;
}

export interface ProjectStore {
  insert(project: Project): Promise<void>;
  get(id: string): Promise<Project | null>;
  /** Return at most limit + 1 records, newest first. */
  list(accountId: string, page: PageRequest): Promise<Project[]>;
  saveFinding(projectId: string, finding: Finding): Promise<void>;
  findings(projectId: string, page: PageRequest): Promise<Finding[]>;
  sessionFindings(sessionId: string): Promise<Finding[]>;
  findingStats(projectId: string): Promise<{ count: number; lastAt: number | null }>;
}
