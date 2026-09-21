// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their public
// indexes.
//
// This file is the composition root, and the only place that knows all five
// slices. It builds what core provides, lets each slice register its routes and
// claim its commands, then listens.
import { openDatabase, type Db } from './core/db/db.js';
import { headerStub } from './core/http/authGuard.js';
import { buildServer, defaultWebRoot } from './core/http/server.js';
import { Broker } from './core/protocol/broker.js';
import { createSessionSlice } from './modules/session/index.js';
import { createBillingSlice } from './modules/billing/index.js';
import { createIdentitySlice, LoginGate, type IdentitySlice } from './modules/identity/index.js';
import { createProjectsSlice, type ProjectsSlice } from './modules/projects/index.js';

const DEFAULT_PORT = 4000;

/** A misspelt port should say so, not arrive at listen() as NaN. */
function port(): number {
  const raw = process.env['LUMEN_PORT'];
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`LUMEN_PORT must be a port number, got "${raw}"`);
  }
  return parsed;
}

/**
 * With DATABASE_URL the process connects and migrates before it serves. Without
 * it the slices keep their records in memory, which is enough to develop a page
 * against and nothing more: a restart forgets everything.
 */
async function database(): Promise<Db | null> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('DATABASE_URL is required in production');
    }
    return null;
  }
  return openDatabase(url);
}

function identitySlice(db: Db): IdentitySlice {
  const origin = process.env['LUMEN_ORIGIN'];
  if (!origin) throw new Error('LUMEN_ORIGIN is required with DATABASE_URL');
  const lifetime = Number(process.env['IDENTITY_SESSION_LIFETIME_MS']);
  if (!Number.isSafeInteger(lifetime) || lifetime <= 0) {
    throw new Error('IDENTITY_SESSION_LIFETIME_MS must be a positive integer');
  }
  const insecure = process.env['IDENTITY_INSECURE_COOKIES'];
  if (insecure !== undefined && insecure !== 'true' && insecure !== 'false') {
    throw new Error('IDENTITY_INSECURE_COOKIES must be true or false');
  }
  return createIdentitySlice({
    database: db,
    origin,
    sessionLifetimeMs: lifetime,
    loginGate: new LoginGate(),
    ...(insecure === undefined ? {} : { secureCookies: insecure !== 'true' }),
  });
}

async function bootstrap(): Promise<void> {
  const db = await database();
  // Stub credentials are accepted only in database-free, non-production development.
  const identity = db ? identitySlice(db) : null;
  const resolver = identity?.principalResolver ?? headerStub;
  const broker = new Broker();
  const billing = createBillingSlice({ db });
  // Sprint 1 runs the echo worker; steering passes its own here when it lands.
  const session = createSessionSlice({
    broker,
    db,
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

  const webRoot = defaultWebRoot();
  const app = await buildServer({
    broker,
    resolver,
    // The session slice knows who opened a session, so it answers who may
    // watch it. Projects' projectOf(sessionId) refines this once it lands.
    access: session.access,
    ...(webRoot ? { webRoot } : {}),
  });

  app.get('/api/health', () => ({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));

  // Each slice registers itself here once it has routes to serve or commands to
  // claim. Session is wired; identity, projects, steering and billing follow
  // the same two lines.
  //
  // Projects, when it lands, goes in like this. The two slices need each
  // other, so session is given closures and projects is built second:
  //
  //   let projects: ProjectsSlice;
  //   const session = createSessionSlice({ broker, db,
  //     requireProject: (principal, id) => projects.requireProject(principal, id),
  //     recordFinding: (sessionId, taskId, text) => projects.recordFinding(sessionId, taskId, text),
  //   });
  //   projects = createProjectsSlice({ sessions: session.projects, db });
  //   await app.register(projects.registerRoutes);
  await app.register(projects.registerRoutes);
  if (identity) await app.register(identity.registerRoutes);
  app.log.info(
    `active principal resolver: ${identity ? 'identity cookie' : 'development header stub'}`,
  );
  await app.register(session.registerRoutes);
  await app.register(billing.registerRoutes);
  session.registerCommands(broker);

  await app.listen({ port: port(), host: '0.0.0.0' });
  if (webRoot) app.log.info(`serving the built web app from ${webRoot}`);
  if (orphans > 0) app.log.info(`stopped ${orphans} task(s) left open by the last process`);
  app.log.info(db ? 'database connected, migrations applied' : 'no DATABASE_URL: in-memory mode');

  // Drain in-flight work before exiting, so a rolling deploy does not cut a
  // browser off mid-event. Fastify's close() also runs the websocket plugin's
  // preClose, which is what releases the sockets still watching a session.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info(`${signal} received, closing`);
      app
        .close()
        .then(() => db?.close())
        .then(
          () => process.exit(0),
          () => process.exit(1),
        );
    });
  }
}

bootstrap().catch((error: unknown) => {
  console.error('lumen failed to start', error);
  process.exit(1);
});
