// Public index for the session slice. Owner: LIU ZIYANG.
import type { FastifyInstance } from 'fastify';
import type { Log } from '../../core/log/log.js';
import type { Db } from '../../core/db/db.js';
import type { BudgetApprovalResume, BudgetGuard } from '../../core/domain/budget.js';
import type { Worker } from '../../core/domain/worker.js';
import type { SessionAccess } from '../../core/http/authGuard.js';
import type { Broker } from '../../core/protocol/broker.js';
import { demoWorker } from './demoWorker.js';
import { sessionDirectory, type SessionDirectory } from './directory.js';
import { Kernel, type FindingSaver } from './kernel.js';
import { MemoryTrace } from './memoryTrace.js';
import type { SpendRecorder } from './spendRecorder.js';
import { PgTrace } from './pgTrace.js';
import { sessionCommands, sessionRoutes, type ProjectGate } from './routes.js';

export type { SpendRecorder } from './spendRecorder.js';
export type { Node } from './taskComposite.js';
export { buildTree, TaskNode } from './taskComposite.js';
export type { FindingSaver, Kernel } from './kernel.js';
export { APPROVED_WORK_DONE } from './kernel.js';
export { demoWorker, paceFromEnv, type DemoOptions } from './demoWorker.js';
export type { SessionDirectory } from './directory.js';
export type { ProjectGate } from './routes.js';

export interface SessionSlice {
  readonly kernel: Kernel;
  /** Hand to buildServer: who may watch a session's event stream. */
  readonly access: SessionAccess;
  readonly registerRoutes: (app: FastifyInstance) => void;
  readonly registerCommands: (broker: Broker) => void;
  /** Hand to createProjectsSlice({ sessions }): what projects needs from sessions. */
  readonly projects: SessionDirectory;
  /** Hand to the billing slice: the way back after an approval it escalated. */
  readonly approvals: BudgetApprovalResume;
}

/**
 * Wire the slice. main.ts calls this once; a test calls it per case. With a Db
 * the record is in Postgres; without one it is in memory and a restart forgets
 * it. The worker defaults to the demo worker; main.ts passes steering's when it lands.
 */
export function createSessionSlice(deps: {
  broker: Broker;
  worker?: Worker;
  db?: Db | null;
  /** From the projects slice: may this principal open a session under this project? */
  requireProject?: ProjectGate;
  /** From the projects slice: where findings are kept. */
  recordFinding?: FindingSaver;
  /** From the billing slice: asked at the three check points. Absent means allow. */
  budget?: BudgetGuard;
  /** Ledger writer; participates in the trace transaction when db is provided. */
  recordSpend?: SpendRecorder;
  /** The process's logger; the slice writes through a child of it. */
  log?: Log;
  /** The models a session may be opened with, the default first. */
  models?: readonly string[];
}): SessionSlice {
  const trace = deps.db ? new PgTrace(deps.db, deps.recordSpend) : new MemoryTrace();
  const kernel = new Kernel(trace, deps.broker, deps.worker ?? demoWorker(), {
    ...(deps.recordFinding ? { saveFinding: deps.recordFinding } : {}),
    ...(deps.budget ? { budget: deps.budget } : {}),
    ...(deps.log ? { log: deps.log.child({ slice: 'session' }) } : {}),
    ...(deps.models ? { models: deps.models } : {}),
  });
  return {
    kernel,
    access: kernel.access,
    registerRoutes: sessionRoutes(kernel, deps.requireProject),
    registerCommands: sessionCommands(kernel),
    projects: sessionDirectory(kernel, trace),
    approvals: { requestResume: (input) => kernel.requestResume(input) },
  };
}
