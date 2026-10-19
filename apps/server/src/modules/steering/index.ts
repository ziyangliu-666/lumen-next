// Public index for the steering slice.
// Everything the rest of the monolith may use from here is re-exported from
// this file and nowhere else.
import type { FastifyInstance } from 'fastify';
import type { Worker } from '../../core/domain/worker.js';
import type { ModelProvider } from '../../core/model/index.js';
import type { Broker } from '../../core/protocol/broker.js';
import { steeringCommands, type SessionContext, type TaskSession } from './commands.js';
import { steeringRoutes, type ProjectGate } from './routes.js';
import type { SandboxSetup } from './compute.js';
import { SteerRegistry } from './steerRegistry.js';
import { createWorker } from './worker.js';

export type { SandboxSetup } from './compute.js';
export type { FileEntry, Scope } from './sandboxFs.js';
export { SandboxFs, SandboxPathError, SandboxQuotaError } from './sandboxFs.js';
export type { ProjectGate } from './routes.js';
export type { SessionContext, TaskSession } from './commands.js';
export type { Compute, ComputeResult } from './compute.js';
export { compute, DockerCompute, NullCompute } from './compute.js';

export interface SteeringSlice {
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly registerCommands: (broker: Broker) => void;
  /** Hand to createSessionSlice({ worker }): the agent loop, on the current Worker interface. */
  readonly worker: Worker;
}

/** No session wiring given: every task.steer is refused, every reader reports no project — fails closed, not crashed. */
const noTaskSession: TaskSession = () => Promise.resolve(null);
const noSessionContext: SessionContext = () => Promise.resolve(null);

/**
 * Wire the slice. main.ts calls this once; a test calls it per case, usually
 * against a temp volume. `taskSession`/`sessionContext` come from the session
 * slice's own public index (`session.projects.taskSession`/`context`) — the
 * same trusted, no-principal calls the projects slice uses, used here because a task's ownership runs through its
 * session, not through a project id steering never sees in `task.steer`.
 */
export function createSteeringSlice(deps: {
  volumeRoot: string;
  /** From the projects slice: may this principal touch this project? Untrusted :id without one. */
  requireProject?: ProjectGate;
  taskSession?: TaskSession;
  sessionContext?: SessionContext;
  /** Which Compute a reader runs against. Defaults to 'none': no Docker required to run this slice. */
  computeProvider?: 'docker' | 'none';
  /** Who the worker thinks with. Defaults to the model that does nothing. */
  model?: ModelProvider;
  /** The sandbox's image and the packages mounted into it. */
  sandbox?: SandboxSetup;
}): SteeringSlice {
  const registry = new SteerRegistry();
  const sessionContext = deps.sessionContext ?? noSessionContext;

  return {
    registerRoutes: steeringRoutes(deps.volumeRoot, deps.requireProject),
    registerCommands: steeringCommands({
      registry,
      taskSession: deps.taskSession ?? noTaskSession,
      sessionContext,
    }),
    worker: createWorker({
      volumeRoot: deps.volumeRoot,
      context: sessionContext,
      registry,
      ...(deps.computeProvider ? { provider: deps.computeProvider } : {}),
      ...(deps.model ? { model: deps.model } : {}),
      ...(deps.sandbox ? { sandbox: deps.sandbox } : {}),
    }),
  };
}
