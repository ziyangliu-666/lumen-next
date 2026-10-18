import type { Finding, PageRequest, Project } from './models.js';

/** The session owner supplies this through its public index at composition time. */
export type { SessionDirectory as ProjectSessions } from '../session/index.js';

export interface ProjectStore {
  insert(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<Project | null>;
  /**
   * Renames a project. 'person' always applies. 'model' applies only over
   * a name cut from the question, so a later session or a generated title
   * never replaces the first title or the person's own. True when applied.
   */
  retitle(id: string, title: string, source: 'model' | 'person'): Promise<boolean>;
  visit(id: string, accountId: string, at: number, spend: number): Promise<Project | null>;
  /** Return at most limit + 1 records, newest first. */
  list(accountId: string, page: PageRequest): Promise<Project[]>;
  saveFinding(projectId: string, finding: Finding): Promise<void>;
  findings(projectId: string, page: PageRequest): Promise<Finding[]>;
  sessionFindings(sessionId: string): Promise<Finding[]>;
  findingStats(
    projectId: string,
    since?: number,
  ): Promise<{ count: number; lastAt: number | null; added: number }>;
}
