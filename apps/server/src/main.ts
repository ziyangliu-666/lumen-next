// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their public
// indexes.
//
// This file is the process: it reads the environment, opens the database,
// builds the application (app.ts), listens, and shuts down cleanly. What the
// application is made of is in app.ts.
import { composeApp, type IdentityConfig } from './app.js';
import { openDatabase, type Db } from './core/db/db.js';
import { defaultWebRoot } from './core/http/server.js';
import { createLog } from './core/log/log.js';
import { modelFromEnv } from './core/model/index.js';
import { oauthProvidersFromEnvironment } from './modules/identity/index.js';
import { demoWorker, paceFromEnv } from './modules/session/index.js';

const DEFAULT_PORT = 4000;

// JSON lines on stdout, where a host collects them; readable lines on a
// terminal (docs/LOGGING.md).
const log = createLog({
  level: process.env['LUMEN_LOG_LEVEL'] ?? 'info',
  pretty: process.stdout.isTTY === true && process.env['NODE_ENV'] !== 'production',
});

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
    // Without a database the stub resolver is what answers "who is asking",
    // and the stub lets anybody be anybody. That must never serve production.
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('DATABASE_URL is required in production');
    }
    return null;
  }
  return openDatabase(url, { log });
}

/** LUMEN_COMPUTE_PROVIDER: which Compute steering's worker runs a reader's command against. */
function computeProvider(): 'docker' | 'none' | undefined {
  const raw = process.env['LUMEN_COMPUTE_PROVIDER'];
  if (raw === undefined || raw === '') return undefined;
  if (raw !== 'docker' && raw !== 'none') {
    throw new Error(`LUMEN_COMPUTE_PROVIDER must be "docker" or "none", got "${raw}"`);
  }
  return raw;
}

function identityConfig(): IdentityConfig {
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
  return {
    origin,
    sessionLifetimeMs: lifetime,
    oauthProviders: oauthProvidersFromEnvironment(process.env, origin, {
      allowLoopbackHttp: process.env['NODE_ENV'] !== 'production' && insecure === 'true',
    }),
    ...(insecure === undefined ? {} : { secureCookies: insecure !== 'true' }),
  };
}

async function bootstrap(): Promise<void> {
  const db = await database();
  const webRoot = defaultWebRoot();
  const volumeRoot = process.env['LUMEN_VOLUME_ROOT'];
  // LUMEN_WORKER=steering runs steering's own agent loop instead of the demo
  // worker. Off by default: the demo worker is what the whole team's staging
  // and local runs have shown since Sprint 1, and e2e.test.ts's join-the-
  // slices test asserts its exact fan-out — that default does not move here.
  const useSteeringWorker = process.env['LUMEN_WORKER'] === 'steering';
  const provider = computeProvider();
  const { server, orphans, resolver } = await composeApp({
    db,
    log,
    // Real sign-in whenever there is a database; the stub only without one.
    identity: db ? identityConfig() : null,
    ...(useSteeringWorker
      ? { useSteeringWorker: true }
      : {
          // Paced, so that a person can see the page is live. Tests build the
          // application without this and do not wait. LUMEN_MODEL_PROVIDER
          // gives the lead a real model to think and reply with; without it the
          // lead says its fixed lines and nothing is spent on a model.
          worker: demoWorker({
            paceMs: paceFromEnv(process.env['LUMEN_DEMO_PACE_MS']),
            model: modelFromEnv(process.env),
          }),
        }),
    ...(webRoot ? { webRoot } : {}),
    ...(volumeRoot ? { volumeRoot } : {}),
    ...(provider ? { computeProvider: provider } : {}),
  });

  await server.listen({ port: port(), host: '0.0.0.0' });
  server.log.info(`active principal resolver: ${resolver}`);
  if (webRoot) server.log.info(`serving the built web app from ${webRoot}`);
  if (orphans > 0) server.log.info(`stopped ${orphans} task(s) left open by the last process`);
  server.log.info(
    db ? 'database connected, migrations applied' : 'no DATABASE_URL: in-memory mode',
  );

  // Drain in-flight work before exiting, so a rolling deploy does not cut a
  // browser off mid-event. Fastify's close() also runs the websocket plugin's
  // preClose, which is what releases the sockets still watching a session.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.log.info(`${signal} received, closing`);
      server
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
  log.fatal({ err: error }, 'lumen failed to start');
  process.exit(1);
});
