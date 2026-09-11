// Public index for the session slice. Owner: LIU ZIYANG.
import type { FastifyInstance } from 'fastify';
import type { Worker } from '../../core/domain/worker.js';
import type { SessionAccess } from '../../core/http/authGuard.js';
import type { Broker } from '../../core/protocol/broker.js';
import { echoWorker } from './echoWorker.js';
import { Kernel } from './kernel.js';
import { sessionCommands, sessionRoutes } from './routes.js';
import { Trace } from './trace.js';

export type { Node } from './taskComposite.js';
export { TaskNode } from './taskComposite.js';
export type { Kernel } from './kernel.js';

export interface SessionSlice {
  readonly kernel: Kernel;
  /** Hand to buildServer: who may watch a session's event stream. */
  readonly access: SessionAccess;
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly registerCommands: (broker: Broker) => void;
}

/**
 * Wire the slice. main.ts calls this once; a test calls it per case. The
 * worker defaults to the Sprint 1 echo; main.ts passes steering's when it lands.
 */
export function createSessionSlice(deps: { broker: Broker; worker?: Worker }): SessionSlice {
  const kernel = new Kernel(new Trace(), deps.broker, deps.worker ?? echoWorker);
  return {
    kernel,
    access: kernel.access,
    registerRoutes: sessionRoutes(kernel),
    registerCommands: sessionCommands(kernel),
  };
}
