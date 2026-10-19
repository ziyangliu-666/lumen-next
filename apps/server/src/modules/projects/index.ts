// Public index for the projects slice.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../core/db/db.js';
import { nullLog, type Log } from '../../core/log/log.js';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { PgProjectStore } from './pgProjectStore.js';
import type { ProjectSessions } from './ports.js';
import { ProjectService } from './projectService.js';
import { projectRoutes } from './routes.js';

export type { ProjectSessions } from './ports.js';
export type { Finding, LatestSession, ProjectCard, ProjectMode, Page } from './models.js';
export interface ProjectsSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly recordFinding: ProjectService['recordFinding'];
  readonly listFindings: ProjectService['listFindings'];
  readonly projectOf: ProjectService['projectOf'];
  readonly requireProject: ProjectService['requireProject'];
  readonly autoTitle: ProjectService['autoTitle'];
}
/** Instance-scoped composition, matching session; no process-global mutable singleton. */
export function createProjectsSlice(deps: {
  sessions: ProjectSessions;
  db?: Db | null;
  log?: Log;
}): ProjectsSlice {
  const service = new ProjectService(
    deps.db ? new PgProjectStore(deps.db) : new MemoryProjectStore(),
    deps.sessions,
    (deps.log ?? nullLog).child({ slice: 'projects' }),
  );
  return {
    registerRoutes: projectRoutes(service),
    recordFinding: service.recordFinding.bind(service),
    listFindings: service.listFindings.bind(service),
    projectOf: service.projectOf.bind(service),
    requireProject: service.requireProject.bind(service),
    autoTitle: service.autoTitle.bind(service),
  };
}
