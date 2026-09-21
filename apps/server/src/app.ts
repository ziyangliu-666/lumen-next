// The composition root: the only place that knows all the slices. It builds
// what core provides, introduces the slices to each other through their ports,
// and lets each one register its routes and claim its commands.
//
// It does not read the environment and it does not listen. main.ts does both,
// so that a test can build the whole application, exactly as production builds
// it, against a database of its own (e2e.test.ts).
import type { FastifyInstance } from 'fastify';
import type { Db } from './core/db/db.js';
import { headerStub } from './core/http/authGuard.js';
import { buildServer } from './core/http/server.js';
import { Broker } from './core/protocol/broker.js';
import type { Worker } from './core/domain/worker.js';
import { createBillingSlice } from './modules/billing/index.js';
import { createIdentitySlice, LoginGate } from './modules/identity/index.js';
import { createProjectsSlice, type ProjectsSlice } from './modules/projects/index.js';
import { createSessionSlice, type SessionSlice } from './modules/session/index.js';

export interface IdentityConfig {
  /** The one origin the browser uses. Every request that is not a GET must name it. */
  readonly origin: string;
  readonly sessionLifetimeMs: number;
  /** False only for plain HTTP on a loopback or a staging container. */
  readonly secureCookies?: boolean;
}

export interface AppOptions {
  /** Null keeps every record in memory: enough to develop a page against, and no more. */
  readonly db: Db | null;
  /**
   * Real sign-in needs a database. With both, the cookie resolver is the only
   * way in and the stub is refused. Without, the Sprint 1 stub header and
   * cookie are accepted, which main.ts never allows in production.
   */
  readonly identity: IdentityConfig | null;
  readonly webRoot?: string;
  readonly logLevel?: string;
  /** The agent loop. Left out, the session slice runs its demo worker. */
  readonly worker?: Worker;
}

export interface App {
  readonly server: FastifyInstance;
  readonly session: SessionSlice;
  /** How many tasks the last process left open, now stopped. */
  readonly orphans: number;
  readonly resolver: 'identity cookie' | 'development header stub';
}

export async function composeApp(options: AppOptions): Promise<App> {
  const { db } = options;
  if (options.identity && !db) throw new Error('identity needs a database');
  const identity =
    options.identity && db
      ? createIdentitySlice({
          database: db,
          origin: options.identity.origin,
          sessionLifetimeMs: options.identity.sessionLifetimeMs,
          loginGate: new LoginGate(),
          ...(options.identity.secureCookies === undefined
            ? {}
            : { secureCookies: options.identity.secureCookies }),
        })
      : null;

  const broker = new Broker();
  const billing = createBillingSlice({ db });
  // Session and projects need each other: a session is opened under a project,
  // and a project shows its sessions. Session is given closures and projects is
  // built second; the closures only run on a request, by which time it exists.
  const session = createSessionSlice({
    broker,
    db,
    ...(options.worker ? { worker: options.worker } : {}),
    requireProject: (principal, id) => projects.requireProject(principal, id),
    recordFinding: (sessionId, taskId, text) => projects.recordFinding(sessionId, taskId, text),
    ...(db ? { recordSpend: billing.record } : {}),
    // Not yet: `budget: billing.budgetGuard`. The chain fails closed, and a new
    // account's cap is 0, so wiring it today would refuse every session. It goes
    // in when billing gives a new account a default cap (see the review on #21).
  });
  const projects: ProjectsSlice = createProjectsSlice({ sessions: session.projects, db });

  // Before anything can connect: tasks left open by the last process are over.
  const orphans = await session.kernel.restore();

  const server = await buildServer({
    broker,
    resolver: identity?.principalResolver ?? headerStub,
    // The session slice knows who opened a session, so it answers who may watch it.
    access: session.access,
    ...(options.webRoot ? { webRoot: options.webRoot } : {}),
    ...(options.logLevel ? { logLevel: options.logLevel } : {}),
  });

  server.get('/api/health', () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }));

  // A slice goes in with these lines and no others: register its routes, and
  // claim its commands if it has any. Steering is the one still to come.
  if (identity) await server.register(identity.registerRoutes);
  await server.register(projects.registerRoutes);
  await server.register(session.registerRoutes);
  await server.register(billing.registerRoutes);
  session.registerCommands(broker);

  return {
    server,
    session,
    orphans,
    resolver: identity ? 'identity cookie' : 'development header stub',
  };
}
