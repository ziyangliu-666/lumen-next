// Public index for the session slice. Owner: LIU ZIYANG.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../core/db/db.js';
import type { Worker } from '../../core/domain/worker.js';
import type { SessionAccess } from '../../core/http/authGuard.js';
import type { Broker } from '../../core/protocol/broker.js';
import { echoWorker } from './echoWorker.js';
import { Kernel } from './kernel.js';
import { MemoryTrace } from './memoryTrace.js';
import { PgTrace } from './pgTrace.js';
import { sessionCommands, sessionRoutes } from './routes.js';

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
 * Wire the slice. main.ts calls this once; a test calls it per case. With a Db
 * the record is in Postgres; without one it is in memory and a restart forgets
 * it. The worker defaults to the echo; main.ts passes steering's when it lands.
 */
export function createSessionSlice(deps: {
  broker: Broker;
  worker?: Worker;
  db?: Db | null;
}): SessionSlice {
  const trace = deps.db ? new PgTrace(deps.db) : new MemoryTrace();
  const kernel = new Kernel(trace, deps.broker, deps.worker ?? echoWorker);
  return {
    kernel,
    access: kernel.access,
    registerRoutes: sessionRoutes(kernel),
    registerCommands: sessionCommands(kernel),
  };
}
