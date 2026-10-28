// The project service: the project pages and their findings
// (docs/platform/contract.md, "The services"). It is the projects slice, built
// the way app.ts builds it, in a process of its own.
//
// Projects take session's SessionDirectory as a port. In the monolith that is
// the session slice in the same process. Here the kernel runs only in the
// session pod, so the directory is an HTTP client for the session service.
// The identity slice is built over the shared database only for its cookie
// resolver; its routes belong to the identity service.
import { buildServer } from '../core/http/server.js';
import type { SessionAccess } from '../core/http/authGuard.js';
import { Broker } from '../core/protocol/broker.js';
import { createIdentitySlice, LoginGate } from '../modules/identity/index.js';
import { createProjectsSlice } from '../modules/projects/index.js';
import { registerAgentRoutes, registerUsageRoutes } from './platform/agentRoutes.js';
import { PgApiKeyStore, withApiKeys } from './platform/apiKeys.js';
import { registerAskRoutes } from './platform/askRoutes.js';
import { registerKeyGuard } from './platform/keyGuard.js';
import { registerOpenApiRoute } from './platform/openapi.js';
import { AgentStore, IntentStore, UsageStore } from './platform/registry.js';
import { remoteSessionDirectory } from './shared/directory.js';
import {
  database,
  identityConfig,
  internalKey,
  serviceLog,
  sessionUrl,
  strictTransport,
} from './shared/env.js';
import { internalCaller } from './shared/internal.js';
import { run, serve } from './shared/serve.js';

const log = serviceLog('project');

// The Ingress sends /ws to session. Nobody watches a session through this pod.
const noSessions: SessionAccess = { canWatch: () => Promise.resolve(false) };

async function start(): Promise<void> {
  const config = identityConfig();
  // Read before the database opens: a missing key should fail fast, not after
  // a migration wait.
  const key = internalKey();
  const call = internalCaller(sessionUrl(), key);
  const db = await database(log);
  // Mail and OAuth are left out: they only serve identity's own routes.
  const identity = createIdentitySlice({
    database: db,
    origin: config.origin,
    sessionLifetimeMs: config.sessionLifetimeMs,
    loginGate: new LoginGate(),
    log,
    ...(config.secureCookies === undefined ? {} : { secureCookies: config.secureCookies }),
  });
  const projects = createProjectsSlice({ sessions: remoteSessionDirectory(call), db, log });

  const resolver = withApiKeys(identity.principalResolver, new PgApiKeyStore(db), log);
  const server = await buildServer({
    broker: new Broker(),
    resolver,
    access: noSessions,
    ...(strictTransport() ? { strictTransport: true } : {}),
    log,
  });
  registerKeyGuard(server, { resolver, internalKey: key });
  server.get('/api/health', () => ({
    status: 'ok',
    service: 'project',
    uptimeSeconds: Math.round(process.uptime()),
  }));
  await server.register(projects.registerRoutes);
  // The public API v1 (docs/platform/public-api.md): the registry, asking, usage.
  const agents = new AgentStore(db);
  registerAgentRoutes(server, { agents });
  registerAskRoutes(server, { agents, intents: new IntentStore(db), internalKey: key });
  registerUsageRoutes(server, { usage: new UsageStore(db) });
  registerOpenApiRoute(server);

  await serve(server, log, [() => db.close()]);
}

run(log, start);
