// The session service: the kernel, the live event stream (/ws), the session
// routes, and the built web app. It is the monolith's composition (app.ts)
// with two changes, and only these:
//
// 1. The kernel's worker is a QueueWorker. Each turn goes on lumen.turns and a
//    worker pod runs it; the worker's report calls come back on
//    /internal/turns/* (docs/platform/contract.md, "A turn", "The report").
// 2. task.steer is not claimed by steering here. It is published on the
//    lumen.steers fanout, because the turn being steered runs in a worker pod.
//
// Projects and billing are built in-process over the shared database for the
// ports the kernel needs (requireProject, recordFinding, onTitle, budget,
// recordSpend). Their routes are served by their own services, not here.
//
// There is one replica: the kernel holds running tasks in memory.
import { randomUUID } from 'node:crypto';
import { Broker } from '../core/protocol/broker.js';
import { buildServer, defaultWebRoot } from '../core/http/server.js';
import {
  createBillingSlice,
  eraseAccountSecrets,
  removeOwnOpenAiKey,
} from '../modules/billing/index.js';
import { createIdentitySlice, LoginGate } from '../modules/identity/index.js';
import { createProjectsSlice, type ProjectsSlice } from '../modules/projects/index.js';
import { createSessionSlice } from '../modules/session/index.js';
import { modelChoicesFromEnv } from '../core/model/index.js';
import { registerAnswerRoutes } from './platform/answerRoutes.js';
import { PgApiKeyStore, withApiKeys } from './platform/apiKeys.js';
import { registerKeyGuard } from './platform/keyGuard.js';
import { IntentStore } from './platform/registry.js';
import { registerDirectoryRoutes } from './shared/directory.js';
import {
  database,
  identityConfig,
  internalKey,
  required,
  serviceLog,
  strictTransport,
} from './shared/env.js';
import { requireInternalKey } from './shared/internal.js';
import { registerApprovalResume } from './shared/approvalResume.js';
import { QueueWorker } from './shared/queueWorker.js';
import { connectRabbit } from './shared/rabbit.js';
import { run, serve } from './shared/serve.js';
import { registerTurnRoutes } from './shared/turnRoutes.js';

const log = serviceLog('session');

run(log, async () => {
  const key = internalKey();
  const config = identityConfig();
  const db = await database(log);
  const bus = await connectRabbit(required('RABBITMQ_URL'), log);

  // Identity is here only for its cookie resolver and for billing's ports.
  const identity = createIdentitySlice({
    database: db,
    origin: config.origin,
    sessionLifetimeMs: config.sessionLifetimeMs,
    loginGate: new LoginGate(),
    log,
    onAccountDeleting: eraseAccountSecrets,
    removeOwnOpenAiKey,
    ...(config.secureCookies === undefined ? {} : { secureCookies: config.secureCookies }),
  });
  const billing = createBillingSlice({
    log,
    db,
    canSpend: identity.canSpend,
    adminAccounts: identity,
    adminChanges: identity,
    origin: config.origin,
    approvalResume: { requestResume: (input) => session.approvals.requestResume(input) },
  });

  const broker = new Broker();
  const turns = new QueueWorker((turn) => bus.publishTurn(turn), randomUUID);
  const choices = modelChoicesFromEnv(process.env);
  const session = createSessionSlice({
    broker,
    db,
    worker: turns,
    ...(choices.size > 1 ? { models: [...choices.keys()] } : {}),
    requireProject: (principal, id) => projects.requireProject(principal, id),
    recordFinding: (sessionId, taskId, text, title) =>
      projects.recordFinding(sessionId, taskId, text, title),
    onTitle: (projectId, title) => projects.autoTitle(projectId, title),
    recordSpend: billing.record,
    budget: billing.budgetGuard,
    log,
  });
  const projects: ProjectsSlice = createProjectsSlice({ sessions: session.projects, db, log });

  // Tasks a previous session pod left running are over: their turns died with it.
  const orphans = await session.kernel.restore();
  if (orphans > 0) log.info(`stopped ${orphans} task(s) left open by the last process`);

  const webRoot = defaultWebRoot();
  const resolver = withApiKeys(identity.principalResolver, new PgApiKeyStore(db), log);
  const server = await buildServer({
    broker,
    resolver,
    access: session.access,
    ...(webRoot ? { webRoot } : {}),
    ...(strictTransport() ? { strictTransport: true } : {}),
    log,
  });
  registerKeyGuard(server, { resolver, internalKey: key });
  server.get('/api/health', () => ({
    status: 'ok',
    service: 'session',
    uptimeSeconds: Math.round(process.uptime()),
  }));
  server.get('/internal/health', { preHandler: requireInternalKey(key) }, () => ({
    turnsInFlight: turns.inFlight,
  }));

  await server.register(session.registerRoutes);
  const intents = new IntentStore(db);
  registerAnswerRoutes(server, {
    snapshot: (sessionId, principal) => session.kernel.snapshot(sessionId, principal),
    findings: (sessionId) => projects.listFindings(sessionId),
    agentOfSession: (sessionId) => intents.agentOfSession(sessionId),
  });
  session.registerCommands(broker);
  broker.onCommand('task.steer', (command, principal) => bus.publishSteer({ command, principal }));

  registerTurnRoutes(server, turns, key);
  registerDirectoryRoutes(server, session.projects, key);
  registerApprovalResume(server, session.approvals, key);

  await serve(server, log, [() => bus.close(), () => db.close()]);
  log.info('session service listening; turns go to lumen.turns');
});
