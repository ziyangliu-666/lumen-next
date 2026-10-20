// The billing service: the wallet, the saved model keys, top-ups, approvals
// and the admin pages (docs/platform/contract.md, "The services"). It is the
// billing slice, built the way app.ts builds it, in a process of its own.
//
// Billing's ports to identity only touch the shared database, so the identity
// slice is built here, in-process, and gives billing the same closures as in
// the monolith. Its routes belong to the identity service. One port cannot
// stay in-process: an approval resumes a task that is running in the session
// pod's kernel, so that port is an internal HTTP call to session
// (docs/platform/contract.md, "The approval resume").
import { buildServer } from '../core/http/server.js';
import type { SessionAccess } from '../core/http/authGuard.js';
import { Broker } from '../core/protocol/broker.js';
import {
  createBillingSlice,
  eraseAccountSecrets,
  removeOwnOpenAiKey,
  secretCipherFromEnvironment,
  StripeTopups,
  stripeFromEnvironment,
} from '../modules/billing/index.js';
import { createIdentitySlice, LoginGate } from '../modules/identity/index.js';
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

const log = serviceLog('billing');

// The Ingress sends /ws to session. Nobody watches a session through this pod.
const noSessions: SessionAccess = { canWatch: () => Promise.resolve(false) };

async function start(): Promise<void> {
  // Validate every setting before the database opens, as main.ts does.
  const config = identityConfig();
  const secretCipher = secretCipherFromEnvironment(process.env);
  const stripe = stripeFromEnvironment(process.env);
  if (stripe && stripe.origin !== config.origin) {
    throw new Error('Stripe requires the identity origin');
  }
  const callSession = internalCaller(sessionUrl(), internalKey());
  const db = await database(log);
  // The deletion participants are wired as in app.ts: the key routes below
  // remove a key through identity's account transaction.
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
    ...(stripe ? { topups: new StripeTopups(stripe) } : {}),
    ...(secretCipher
      ? {
          keys: {
            cipher: secretCipher,
            write: (id, work) => identity.withActiveAccount(id, work),
            read: (id, work) => identity.withActiveAccountRead(id, work),
            remove: (id: string) =>
              identity.withActiveAccount(id, (tx) => removeOwnOpenAiKey(id, tx)),
          },
        }
      : {}),
    canSpend: identity.canSpend,
    adminAccounts: identity,
    adminChanges: identity,
    origin: config.origin,
    approvalResume: {
      requestResume: async (input) => {
        await callSession('/internal/approvals/resume', input);
      },
    },
  });

  const server = await buildServer({
    broker: new Broker(),
    resolver: identity.principalResolver,
    access: noSessions,
    ...(strictTransport() ? { strictTransport: true } : {}),
    log,
  });
  server.get('/api/health', () => ({
    status: 'ok',
    service: 'billing',
    uptimeSeconds: Math.round(process.uptime()),
  }));
  await server.register(billing.registerRoutes);

  await serve(server, log, [() => db.close()]);
}

run(log, start);
