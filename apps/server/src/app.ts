// The composition root: the only place that knows all the slices. It builds
// what core provides, introduces the slices to each other through their ports,
// and lets each one register its routes and claim its commands.
//
// It does not read the environment and it does not listen. main.ts does both,
// so that a test can build the whole application, exactly as production builds
// it, against a database of its own (e2e.test.ts).
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Db } from './core/db/db.js';
import { headerStub } from './core/http/authGuard.js';
import { buildServer } from './core/http/server.js';
import { createLog, type Log } from './core/log/log.js';
import { Broker } from './core/protocol/broker.js';
import type { Worker } from './core/domain/worker.js';
import { OpenAICompatible, nullModel, type ModelProvider } from './core/model/index.js';
import { sessionModel } from './sessionModel.js';
import { accountModel } from './accountModel.js';
import {
  createBillingSlice,
  eraseAccountSecrets,
  removeOwnOpenAiKey,
  StripeTopups,
  type StripeConfiguration,
  type SecretCipher,
} from './modules/billing/index.js';
import {
  createIdentitySlice,
  LoginGate,
  type MailConfiguration,
  type MailWorker,
  type OAuthProvider,
} from './modules/identity/index.js';
import { createProjectsSlice, type ProjectsSlice } from './modules/projects/index.js';
import { demoWorker, createSessionSlice, type SessionSlice } from './modules/session/index.js';
import { createSteeringSlice, type SandboxSetup } from './modules/steering/index.js';

export interface IdentityConfig {
  /** The one origin the browser uses. Every request that is not a GET must name it. */
  readonly origin: string;
  readonly sessionLifetimeMs: number;
  /** Constructed from explicit server configuration by main.ts, never from request data. */
  readonly oauthProviders?: readonly OAuthProvider[];
  /** Built by main.ts from explicit configuration. Left out, mail routes are off. */
  readonly mail?: MailConfiguration;
  /** False only for plain HTTP on a loopback or a staging container. */
  readonly secureCookies?: boolean;
}

export interface AppOptions {
  readonly secretCipher?: SecretCipher;
  /** Trusted adapter factory for deterministic provider tests. Production uses the fixed OpenAI endpoint. */
  readonly openaiWithKey?: (key: string) => ModelProvider;
  readonly demoPaceMs?: number;
  readonly stripe?: StripeConfiguration;
  /** Null keeps every record in memory: enough to develop a page against, and no more. */
  readonly db: Db | null;
  /**
   * Real sign-in needs a database. With both, the cookie resolver is the only
   * way in and the stub is refused. Without, the development stub header and
   * cookie are accepted, which main.ts never allows in production.
   */
  readonly identity: IdentityConfig | null;
  readonly webRoot?: string;
  /** Behind HTTPS: send Strict-Transport-Security. main.ts sets it from the origin's scheme. */
  readonly strictTransport?: boolean;
  /** The process's logger. Built here from logLevel when not given. */
  readonly log?: Log;
  readonly logLevel?: string;
  /** The agent loop. Left out, the session slice runs its demo worker (or steering's, see useSteeringWorker). */
  readonly worker?: Worker;
  /** Where SandboxFs stores project files on this host. `.data` next to the process if omitted. */
  readonly volumeRoot?: string;
  /** Which Compute steering's worker runs a reader's command against. Defaults to 'none': no Docker required. */
  readonly computeProvider?: 'docker' | 'none';
  /** The sandbox's image and packages (LUMEN_SANDBOX_IMAGE, LUMEN_SANDBOX_LIBS). */
  readonly sandbox?: SandboxSetup;
  /** Who steering's worker thinks with. The model that does nothing if omitted. */
  readonly model?: ModelProvider;
  /**
   * The models a session may choose, the default first (modelChoicesFromEnv).
   * One or none: no choice, and `model` is used as before.
   */
  readonly modelChoices?: ReadonlyMap<string, ModelProvider>;
  /**
   * Run every session's worker on steering's own agent loop instead of the
   * demo worker — false by default, deliberately, not because it is unready:
   * e2e.test.ts (the join between every slice) asserts the demo worker's
   * exact three-reader fan-out and finding count, so flipping this app-wide
   * default would break the test that exists precisely to catch two slices
   * that no longer fit together. Set true to actually see steering's worker
   * run (main.ts wires this to LUMEN_WORKER=steering); `worker`, if given,
   * still wins over either default.
   */
  readonly useSteeringWorker?: boolean;
}

export interface App {
  readonly server: FastifyInstance;
  readonly session: SessionSlice;
  /** How many tasks the last process left open, now stopped. */
  readonly orphans: number;
  readonly resolver: 'identity cookie' | 'development header stub';
  /** Present when mail is configured. main.ts starts it after listen and stops it on shutdown. */
  readonly mailWorker?: MailWorker;
}

export async function composeApp(options: AppOptions): Promise<App> {
  const { db } = options;
  if (options.secretCipher && (!db || !options.identity))
    throw new Error('Keys require real identity and a database');
  if (
    options.stripe &&
    (!db || !options.identity || options.stripe.origin !== options.identity.origin)
  )
    throw new Error('Stripe requires real identity, a database and the identity origin');
  if (options.identity && !db) throw new Error('identity needs a database');
  const log = options.log ?? createLog({ level: options.logLevel ?? 'info' });
  const identity =
    options.identity && db
      ? createIdentitySlice({
          database: db,
          origin: options.identity.origin,
          sessionLifetimeMs: options.identity.sessionLifetimeMs,
          loginGate: new LoginGate(),
          log,
          // Billing's ciphertext cleanup is wired whether or not key usage is
          // configured: ciphertext must never outlive its account or a removal.
          onAccountDeleting: eraseAccountSecrets,
          removeOwnOpenAiKey,
          ...(options.identity.oauthProviders
            ? { oauthProviders: options.identity.oauthProviders }
            : {}),
          ...(options.identity.mail
            ? { mailSender: options.identity.mail.sender, mailKey: options.identity.mail.key }
            : {}),
          ...(options.identity.secureCookies === undefined
            ? {}
            : { secureCookies: options.identity.secureCookies }),
        })
      : null;

  const broker = new Broker();
  // Without identity there are no real accounts, and billing keeps denying.
  const billing = createBillingSlice({
    log,
    ...(options.stripe ? { topups: new StripeTopups(options.stripe) } : {}),
    db,
    ...(options.secretCipher && identity
      ? {
          keys: {
            cipher: options.secretCipher,
            write: (id, work) => identity.withActiveAccount(id, work),
            read: (id, work) => identity.withActiveAccountRead(id, work),
            remove: (id: string) =>
              identity.withActiveAccount(id, (tx) => removeOwnOpenAiKey(id, tx)),
          },
        }
      : {}),
    ...(identity
      ? { canSpend: identity.canSpend, adminAccounts: identity, adminChanges: identity }
      : {}),
    ...(db && options.identity
      ? {
          origin: options.identity.origin,
          approvalResume: { requestResume: (input) => session.approvals.requestResume(input) },
        }
      : {}),
  });
  // A session's chosen model, when the server offers more than one. It sits
  // under the account's key choice: a saved key still decides who pays.
  const choice =
    options.modelChoices && options.modelChoices.size > 1
      ? sessionModel(options.modelChoices, options.model ?? nullModel)
      : null;
  const platform = choice?.model ?? options.model;
  const account = billing.secret
    ? accountModel(
        platform ?? nullModel,
        billing.secret,
        options.openaiWithKey ??
          ((key) =>
            new OpenAICompatible({
              name: 'openai',
              model: 'gpt-4.1-mini',
              baseUrl: 'https://api.openai.com/v1',
              apiKey: key,
            })),
      )
    : null;
  const model = account?.model ?? platform;
  // Steering needs session's SessionDirectory to check a task.steer's
  // ownership and to find a task's project; session may run steering's own
  // worker. Each is given closures over the other, declared first — same
  // trick as session and projects below: a closure only runs on a request or
  // a task's turn, by which time both exist.
  const steering = createSteeringSlice({
    volumeRoot: options.volumeRoot ?? join(process.cwd(), '.data'),
    requireProject: (principal, id) => projects.requireProject(principal, id),
    taskSession: (taskId) => session.projects.taskSession(taskId),
    sessionContext: (sessionId) => session.projects.context(sessionId),
    ...(options.computeProvider ? { computeProvider: options.computeProvider } : {}),
    ...(options.sandbox ? { sandbox: options.sandbox } : {}),
    ...(model ? { model } : {}),
  });
  const worker =
    options.worker ??
    (options.useSteeringWorker
      ? steering.worker
      : demoWorker({
          ...(model ? { model } : {}),
          ...(options.demoPaceMs === undefined ? {} : { paceMs: options.demoPaceMs }),
        }));
  // Session and projects need each other: a session is opened under a project,
  // and a project shows its sessions. Session is given closures and projects is
  // built second; the closures only run on a request, by which time it exists.
  const session = createSessionSlice({
    broker,
    db,
    worker: ((): Worker => {
      if (options.worker) return worker;
      const keyed = account
        ? account.wrap(
            worker,
            async (id) => (await session.projects.context(id))?.accountId ?? null,
          )
        : worker;
      return choice
        ? choice.wrap(keyed, async (id) => (await session.projects.context(id))?.model)
        : keyed;
    })(),
    ...(options.modelChoices && options.modelChoices.size > 1
      ? { models: [...options.modelChoices.keys()] }
      : {}),
    requireProject: (principal, id) => projects.requireProject(principal, id),
    recordFinding: (sessionId, taskId, text, title) =>
      projects.recordFinding(sessionId, taskId, text, title),
    onTitle: (projectId, title) => projects.autoTitle(projectId, title),
    ...(db ? { recordSpend: billing.record } : {}),
    log,
    ...(db ? { budget: billing.budgetGuard } : {}),
  });
  const projects: ProjectsSlice = createProjectsSlice({ sessions: session.projects, db, log });

  // Before anything can connect: tasks left open by the last process are over.
  const orphans = await session.kernel.restore();

  const server = await buildServer({
    broker,
    resolver: identity?.principalResolver ?? headerStub,
    // The session slice knows who opened a session, so it answers who may watch it.
    access: session.access,
    ...(options.webRoot ? { webRoot: options.webRoot } : {}),
    ...(options.strictTransport ? { strictTransport: true } : {}),
    log,
  });

  server.get('/api/health', () => ({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  }));

  // A slice goes in with these lines and no others: register its routes, and
  // claim its commands if it has any.
  if (identity) await server.register(identity.registerRoutes);
  await server.register(projects.registerRoutes);
  await server.register(session.registerRoutes);
  await server.register(billing.registerRoutes);
  await server.register(steering.registerRoutes);
  session.registerCommands(broker);
  steering.registerCommands(broker);

  return {
    server,
    session,
    orphans,
    resolver: identity ? 'identity cookie' : 'development header stub',
    ...(identity?.mailWorker ? { mailWorker: identity.mailWorker } : {}),
  };
}
