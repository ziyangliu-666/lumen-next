// The identity service: sign-up, sign-in, the account pages and the local
// development routes (docs/platform/contract.md, "The services"). It is the
// identity slice, built the way app.ts builds it, in a process of its own.
//
// Only this service serves identity's routes. The other services build the
// same slice over the same database for one reason: to read the auth cookie.
// Billing's ciphertext cleanup stays wired here, because account deletion runs
// here, and ciphertext must never outlive its account.
import { buildServer } from '../core/http/server.js';
import type { SessionAccess } from '../core/http/authGuard.js';
import { Broker } from '../core/protocol/broker.js';
import { eraseAccountSecrets, removeOwnOpenAiKey } from '../modules/billing/index.js';
import { createIdentitySlice, LoginGate } from '../modules/identity/index.js';
import { PgApiKeyStore, withApiKeys } from './platform/apiKeys.js';
import { registerKeyGuard } from './platform/keyGuard.js';
import { registerKeyRoutes } from './platform/keyRoutes.js';
import {
  database,
  identityConfig,
  internalKey,
  serviceLog,
  strictTransport,
} from './shared/env.js';
import { run, serve } from './shared/serve.js';

const log = serviceLog('identity');

// buildServer requires an answer to "who may watch this session?". This
// service holds no sessions, and the Ingress sends /ws to session, so nobody
// may watch anything here.
const noSessions: SessionAccess = { canWatch: () => Promise.resolve(false) };

async function start(): Promise<void> {
  const config = identityConfig();
  const key = internalKey();
  const db = await database(log);
  const identity = createIdentitySlice({
    database: db,
    origin: config.origin,
    sessionLifetimeMs: config.sessionLifetimeMs,
    loginGate: new LoginGate(),
    log,
    onAccountDeleting: eraseAccountSecrets,
    removeOwnOpenAiKey,
    ...(config.oauthProviders ? { oauthProviders: config.oauthProviders } : {}),
    ...(config.mail ? { mailSender: config.mail.sender, mailKey: config.mail.key } : {}),
    ...(config.secureCookies === undefined ? {} : { secureCookies: config.secureCookies }),
  });

  // API keys (docs/platform/public-api.md): created here, accepted on /api/v1 only.
  const apiKeys = new PgApiKeyStore(db);
  const resolver = withApiKeys(identity.principalResolver, apiKeys, log);
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
    service: 'identity',
    uptimeSeconds: Math.round(process.uptime()),
  }));
  await server.register(identity.registerRoutes);
  registerKeyRoutes(server, { store: apiKeys, resolver });

  const { mailWorker } = identity;
  await serve(server, log, [() => mailWorker?.stop(), () => db.close()]);
  // After listen, as main.ts does: a pod that fails to listen sends no mail.
  mailWorker?.start();
  if (mailWorker) log.info('identity mail worker started');
}

run(log, start);
