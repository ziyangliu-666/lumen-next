// Public index for the steering slice. Owner: LI ZHUOYANG.
// Everything the rest of the monolith may use from here is re-exported from
// this file and nowhere else.
import type { FastifyInstance } from 'fastify';
import { steeringRoutes } from './routes.js';

export type { FileEntry, Scope } from './sandboxFs.js';
export { SandboxFs, SandboxPathError, SandboxQuotaError } from './sandboxFs.js';

export interface SteeringSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
}

/**
 * Wire the slice. main.ts calls this once, with where the sandbox volume
 * lives on this host; a test calls it per case, usually against a temp dir.
 *
 * registerCommands (task.steer, steer.cancel) and worker/compute
 * (docs/ARCHITECTURE.md §7) are not here yet — this only carries the files
 * routes. See apps/server/src/modules/steering/DESIGN.md for what shipped
 * and what is still open.
 */
export function createSteeringSlice(deps: { volumeRoot: string }): SteeringSlice {
  return {
    registerRoutes: steeringRoutes(deps.volumeRoot),
  };
}
