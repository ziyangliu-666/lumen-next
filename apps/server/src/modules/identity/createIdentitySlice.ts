import type { IdentityAuthentication } from './identityAuthentication.js';
import { AccountService } from './accountService.js';
import { MailActions } from './mailActions.js';
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
  readonly mailDeliveryFailed?: () => void;
}

export type IdentitySlice = IdentityAuthentication & AdminAccounts;

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
    registerRoutes: identityRoutes({
      flow,
      sessions,
      accounts,
      management: new AccountService(accounts),
      ...(options.mailSender
        ? {
            mail: new MailActions(
              options.database,
              options.mailSender,
              options.origin,
              options.mailDeliveryFailed,
            ),
          }
        : {}),
      origin: options.origin,
      loginGate: options.loginGate,
      ...(providers.length
        ? { oauth: { providers, attempts: new OAuthAttempts(options.database) } }
        : {}),
      ...(options.secureCookies === undefined ? {} : { secureCookies: options.secureCookies }),
    }),
  };
}
