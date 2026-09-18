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
  if (url === undefined || url === '') return null;
  return openDatabase(url);
}

async function bootstrap(): Promise<void> {
  const db = await database();
  // Sprint 1 trusts `Authorization: stub <id>:<role>`. Identity swaps the real
  // resolver in here, and nothing else in the server changes.
  const resolver = headerStub;
  const broker = new Broker();
  // Sprint 1 runs the echo worker; steering passes its own here when it lands.
  const session = createSessionSlice({ broker, db });
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
  await app.register(session.registerRoutes);
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
