// The worker service: takes turns from lumen.turns.<depth>, runs them with the
// existing worker loop, and reports back to session over HTTP. KEDA adds and
// removes worker pods on the length of those queues
// (docs/platform/contract.md, "A turn", "The report").
//
// The worker loop does not change. It gets a RemoteReport in place of the
// kernel's report, and steering gets a remote SessionDirectory in place of
// session's. A steer arrives on the lumen.steers fanout and goes into a local
// broker, where steering claims it exactly as it does in the monolith.
//
// This service also serves the project files routes, because the files live
// on the volume the workers write.
import { join } from 'node:path';
import { WaitingForApproval, type Worker } from '../core/domain/worker.js';
import { buildServer } from '../core/http/server.js';
import { modelFromEnv } from '../core/model/index.js';
import { Broker } from '../core/protocol/broker.js';
import { createIdentitySlice, LoginGate } from '../modules/identity/index.js';
import { createProjectsSlice } from '../modules/projects/index.js';
import { demoWorker, paceFromEnv } from '../modules/session/index.js';
import { createSteeringSlice } from '../modules/steering/index.js';
import { IntentStore } from './platform/registry.js';
import { rootTurnInput } from './platform/rootTurn.js';
import { remoteSessionDirectory } from './shared/directory.js';
import {
  database,
  identityConfig,
  internalKey,
  required,
  serviceLog,
  sessionUrl,
  strictTransport,
} from './shared/env.js';
import { internalCaller, InternalCallError } from './shared/internal.js';
import type { TurnOutcome } from './shared/queueWorker.js';
import { connectRabbit, type TurnMessage } from './shared/rabbit.js';
import { RemoteReport } from './shared/remoteReport.js';
import { run, serve } from './shared/serve.js';
import { PgApiKeyStore, withApiKeys } from './platform/apiKeys.js';
import { registerKeyGuard } from './platform/keyGuard.js';

const log = serviceLog('worker');

/** Turns one pod runs at once from each depth's queue (LUMEN_WORKER_SLOTS). */
function slots(): number {
  const raw = process.env['LUMEN_WORKER_SLOTS'] ?? '4';
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 64) {
    throw new Error(`LUMEN_WORKER_SLOTS must be a whole number from 1 to 64, got "${raw}"`);
  }
  return parsed;
}

run(log, async () => {
  const key = internalKey();
  const config = identityConfig();
  const choice = process.env['LUMEN_WORKER'] ?? 'demo';
  if (choice !== 'demo' && choice !== 'steering') {
    throw new Error(`LUMEN_WORKER must be "demo" or "steering", got "${choice}"`);
  }
  const db = await database(log);
  const bus = await connectRabbit(required('RABBITMQ_URL'), log);
  const call = internalCaller(sessionUrl(), key);
  const sessions = remoteSessionDirectory(call);

  // Identity for the cookie on the files routes; projects for "may this
  // principal touch this project", which reads only the shared database.
  const identity = createIdentitySlice({
    database: db,
    origin: config.origin,
    sessionLifetimeMs: config.sessionLifetimeMs,
    loginGate: new LoginGate(),
    log,
    ...(config.secureCookies === undefined ? {} : { secureCookies: config.secureCookies }),
  });
  const projects = createProjectsSlice({ sessions, db, log });
  const model = modelFromEnv(process.env);
  const steering = createSteeringSlice({
    volumeRoot: process.env['LUMEN_VOLUME_ROOT'] ?? join(process.cwd(), '.data'),
    requireProject: (principal, id) => projects.requireProject(principal, id),
    taskSession: (taskId) => sessions.taskSession(taskId),
    sessionContext: (sessionId) => sessions.context(sessionId),
    computeProvider: process.env['LUMEN_COMPUTE_PROVIDER'] === 'docker' ? 'docker' : 'none',
    model,
  });
  const worker: Worker =
    choice === 'steering'
      ? steering.worker
      : demoWorker({ model, paceMs: paceFromEnv(process.env['LUMEN_DEMO_PACE_MS']) });

  const steers = new Broker();
  steering.registerCommands(steers);
  await bus.consumeSteers(async ({ command, principal }) => {
    await steers.dispatch(command, principal);
  });

  // A root turn asked through the API may name an agent (docs/platform/public-api.md).
  const intents = new IntentStore(db);
  const inputFor = rootTurnInput({
    context: (sessionId) => sessions.context(sessionId),
    claim: (sessionId, accountId, question) => intents.claim(sessionId, accountId, question),
    log,
  });

  const inHand = new Set<Promise<void>>();
  const runTurn = async (turn: TurnMessage): Promise<void> => {
    const turnLog = log.child({
      turnId: turn.turnId,
      taskId: turn.task.id,
      depth: turn.task.depth,
    });
    const report = new RemoteReport(call, turn.turnId, turnLog);
    let outcome: TurnOutcome;
    try {
      await worker.run(turn.task, await inputFor(turn.task, turn.input), report);
      outcome = { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = { ok: false, error: message, waiting: error instanceof WaitingForApproval };
    }
    try {
      await call(`/internal/turns/${encodeURIComponent(turn.turnId)}/done`, outcome);
    } catch (error) {
      // 404: session no longer waits for this turn (it restarted and stopped
      // the task). Acknowledge it, or it would loop. Any other failure throws,
      // and the turn goes back on the queue.
      if (error instanceof InternalCallError && error.status === 404) {
        turnLog.warn('session no longer knows this turn; dropping it');
        return;
      }
      throw error;
    }
    turnLog.info({ ok: outcome.ok }, 'turn done');
  };
  await bus.consumeTurns((turn) => {
    const work = runTurn(turn);
    inHand.add(work);
    return work.finally(() => inHand.delete(work));
  }, slots());

  // An API key is refused here with 403, as on every path outside /api/v1.
  const resolver = withApiKeys(identity.principalResolver, new PgApiKeyStore(db), log);
  const server = await buildServer({
    broker: new Broker(),
    resolver,
    // The live stream belongs to session. Nobody watches a session here.
    access: { canWatch: () => Promise.resolve(false) },
    ...(strictTransport() ? { strictTransport: true } : {}),
    log,
  });
  registerKeyGuard(server, { resolver, internalKey: key });
  server.get('/api/health', () => ({
    status: 'ok',
    service: 'worker',
    mode: choice,
    turnsInHand: inHand.size,
    uptimeSeconds: Math.round(process.uptime()),
  }));
  await server.register(steering.registerRoutes);

  await serve(server, log, [
    // Take no new turn, finish the ones in hand, then let go of the broker.
    () => bus.stopConsuming(),
    async () => {
      await Promise.allSettled([...inHand]);
    },
    () => bus.close(),
    () => db.close(),
  ]);
  log.info(`worker listening; mode ${choice}, ${slots()} slot(s) per depth`);
});
