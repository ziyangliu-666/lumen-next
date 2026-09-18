// Public index for the projects slice. Owner: PENG XUJIAN.
import type { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import type { Db } from '../../core/db/db.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { PgProjectStore } from './pgProjectStore.js';
import type { ProjectSessions } from './ports.js';
import { ProjectService } from './projectService.js';
import { projectRoutes } from './routes.js';

export type { ProjectSessions } from './ports.js';
export type { Finding, LatestSession, ProjectCard, ProjectMode, Page } from './models.js';
export const projectsMigrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
export interface ProjectsSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly recordFinding: ProjectService['recordFinding'];
  readonly listFindings: ProjectService['listFindings'];
  readonly projectOf: ProjectService['projectOf'];
  readonly requireProject: ProjectService['requireProject'];
}
/** Instance-scoped composition, matching session; no process-global mutable singleton. */
export function createProjectsSlice(deps: {
  sessions: ProjectSessions;
  db?: Db | null;
}): ProjectsSlice {
  const service = new ProjectService(
    deps.db ? new PgProjectStore(deps.db) : new MemoryProjectStore(),
    deps.sessions,
  );
  return {
    registerRoutes: projectRoutes(service),
    recordFinding: service.recordFinding.bind(service),
    listFindings: service.listFindings.bind(service),
    projectOf: service.projectOf.bind(service),
    requireProject: service.requireProject.bind(service),
  };
}
