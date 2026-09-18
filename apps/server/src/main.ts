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
import { createBillingSlice } from './modules/billing/index.js';
import { createIdentitySlice, LoginGate, type IdentitySlice } from './modules/identity/index.js';
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

function positiveInteger(name: string): number {
  const raw = process.env[name];
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function identitySlice(db: Db): IdentitySlice {
  const origin = process.env['LUMEN_ORIGIN'];
  if (!origin) throw new Error('LUMEN_ORIGIN is required with DATABASE_URL');
  const insecure = process.env['IDENTITY_INSECURE_COOKIES'];
  if (insecure !== undefined && insecure !== 'true' && insecure !== 'false') {
    throw new Error('IDENTITY_INSECURE_COOKIES must be true or false');
  }
  return createIdentitySlice({
    database: db,
    origin,
    sessionLifetimeMs: positiveInteger('IDENTITY_SESSION_LIFETIME_MS'),
    loginGate: new LoginGate(),
    ...(insecure === undefined ? {} : { secureCookies: insecure !== 'true' }),
  });
}

async function bootstrap(): Promise<void> {
  const db = await database();
  // Header authentication remains available only in database-free development.
  // Every database-backed process uses identity's cookie resolver.
  const identity = db ? identitySlice(db) : null;
  const resolver = identity?.principalResolver ?? headerStub;
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

  // Each slice registers itself here once it has routes to serve or commands to claim.
  if (identity) {
    await app.register(identity.registerRoutes);
    await app.register(createBillingSlice({ accounts: identity }).registerRoutes);
  }
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
