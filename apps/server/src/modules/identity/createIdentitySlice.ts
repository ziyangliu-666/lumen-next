import type { FastifyPluginAsync } from 'fastify';
import type { PrincipalResolver } from '../../core/http/authGuard.js';
import { AccountService } from './accountService.js';
import { AuthSessions } from './authSessions.js';
import type { IdentityDatabase } from './identityDatabase.js';
import type { LoginGate } from './loginGate.js';
import { PasswordStrategy } from './passwordStrategy.js';
import { PostgresAccountStore, PostgresAuthSessionStore } from './postgresStores.js';
import { identityRoutes } from './routes.js';
import { SessionAuthFlow } from './sessionAuthFlow.js';
import { SessionPrincipalResolver, SessionStrategy } from './sessionStrategy.js';

export interface IdentitySliceOptions {
  readonly database: IdentityDatabase;
  readonly origin: string;
  readonly sessionLifetimeMs: number;
  readonly loginGate: LoginGate;
  readonly secureCookies?: boolean;
}

export interface IdentitySlice {
  readonly principalResolver: PrincipalResolver;
  readonly registerRoutes: FastifyPluginAsync;
}

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
  const flow = new SessionAuthFlow([new PasswordStrategy(accounts), sessionStrategy], sessions);
  return {
    principalResolver: new SessionPrincipalResolver(sessionStrategy),
    registerRoutes: identityRoutes({
      flow,
      sessions,
      accounts,
      management: new AccountService(accounts),
      origin: options.origin,
      loginGate: options.loginGate,
      ...(options.secureCookies === undefined ? {} : { secureCookies: options.secureCookies }),
    }),
  };
}
