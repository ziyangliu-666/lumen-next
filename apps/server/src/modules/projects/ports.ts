import type { Finding, PageRequest, Project } from './models.js';

/** The session owner supplies this through its public index at composition time. */
export type { SessionDirectory as ProjectSessions } from '../session/index.js';

export interface ProjectStore {
  insert(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<Project | null>;
  /** Return at most limit + 1 records, newest first. */
  list(accountId: string, page: PageRequest): Promise<Project[]>;
  saveFinding(projectId: string, finding: Finding): Promise<void>;
  findings(projectId: string, page: PageRequest): Promise<Finding[]>;
  sessionFindings(sessionId: string): Promise<Finding[]>;
  findingStats(projectId: string): Promise<{ count: number; lastAt: number | null }>;
}
