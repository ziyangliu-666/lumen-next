import { nullLog, type Log } from '../../core/log/log.js';
import type { IdentityAuthentication } from './identityAuthentication.js';
import { logMailEvent } from './identityLog.js';
import { AccountService } from './accountService.js';
import { MailActions } from './mailActions.js';
import { MailQueue, MailWorker, type MailEvent } from './mailQueue.js';
import type { MailSender } from './mail.js';
import type { AdminAccounts } from './adminAccounts.js';
import { AuthSessions } from './authSessions.js';
import type { IdentityDatabase } from './identityDatabase.js';
import type { LoginGate } from './loginGate.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { identityRoutes } from './routes.js';
import { SessionAuthFlow } from './sessionAuthFlow.js';
import { SessionPrincipalResolver, SessionStrategy } from './sessionStrategy.js';
import { OAuthAccounts, OAuthAttempts, OAuthStrategy, type OAuthProvider } from './oauth.js';

export interface IdentitySliceOptions {
  readonly database: IdentityDatabase;
  readonly origin: string;
  readonly sessionLifetimeMs: number;
  readonly loginGate: LoginGate;
  readonly secureCookies?: boolean;
  readonly oauthProviders?: readonly OAuthProvider[];
  readonly mailSender?: MailSender;
  /** Server-only HMAC key (32+ characters) for the mail queue's per-address index. */
  readonly mailKey?: string;
  /** Value-free delivery telemetry, called beside the log line for each event. */
  readonly mailEvent?: (event: MailEvent) => void;
  /** Core's logger; the slice writes through log.child({ slice: 'identity' }). */
  readonly log?: Log;
}

export type IdentitySlice = IdentityAuthentication &
  AdminAccounts & {
    /**
     * Account eligibility for billing's AccountHandler: true only for an account
     * that exists, is not suspended and is not deleted. Storage errors reject.
     */
    readonly canSpend: (accountId: string) => Promise<boolean>;
    /** Present with a mailSender; the composition root starts it and stops it on shutdown. */
    readonly mailWorker?: MailWorker;
  };

/**
 * main.ts supplies core's database after migrations. No private pool, migration
 * runner or fallback to the development header exists inside this factory.
 */
export function createIdentitySlice(options: IdentitySliceOptions): IdentitySlice {
  const accounts = new PostgresAccountStore(options.database);
  const sessions = new AuthSessions(new PostgresAuthSessionStore(options.database), {
    lifetimeMs: options.sessionLifetimeMs,
  });
  const sessionStrategy = new SessionStrategy(sessions);
  const providers = options.oauthProviders ?? [];
  if (
    new Set(providers.map((provider) => provider.kind)).size !== providers.length ||
    providers.some((provider) => provider.kind !== 'github' && provider.kind !== 'google')
  ) {
    throw new Error('Invalid OAuth provider configuration');
  }
  const oauthAccounts = new OAuthAccounts(options.database);
  const log = (options.log ?? nullLog).child({ slice: 'identity' });
  const mailEvent = {
    event: (event: MailEvent): void => {
      logMailEvent(log, event);
      options.mailEvent?.(event);
    },
  };
  const mail = options.mailSender
    ? {
        actions: new MailActions(
          options.database,
          new MailQueue(options.database, { key: options.mailKey ?? '', ...mailEvent }),
        ),
        worker: new MailWorker(options.database, options.mailSender, options.origin, mailEvent),
      }
    : null;
  const flow = new SessionAuthFlow(
    [
      new PasswordStrategy(accounts),
      ...providers.map((provider) => new OAuthStrategy(provider, oauthAccounts)),
    ],
    sessions,
  );
  return {
    principalResolver: new SessionPrincipalResolver(sessionStrategy),
    listAccounts: () => accounts.listAccounts(),
    getAccount: (id) => accounts.getAdminAccount(id),
    setRole: (id, role) => accounts.setRole(id, role),
    suspend: (accountId, on) => accounts.suspend(accountId, on),
    canSpend: (accountId) => accounts.canSpend(accountId),
    ...(mail ? { mailWorker: mail.worker } : {}),
    registerRoutes: identityRoutes({
      flow,
      sessions,
      accounts,
      management: new AccountService(accounts),
      ...(mail ? { mail: mail.actions } : {}),
      origin: options.origin,
      loginGate: options.loginGate,
      log,
      ...(providers.length
        ? { oauth: { providers, attempts: new OAuthAttempts(options.database) } }
        : {}),
      ...(options.secureCookies === undefined ? {} : { secureCookies: options.secureCookies }),
    }),
  };
}
