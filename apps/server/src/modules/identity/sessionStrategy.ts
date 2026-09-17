import type { Credentials, Principal, PrincipalResolver } from '../../core/http/authGuard.js';
import type { AuthStrategy } from './authFlow.js';
import type { AuthSessions } from './authSessions.js';

export const AUTH_COOKIE = 'lumen_session';

export class SessionStrategy implements AuthStrategy {
  readonly kind = 'session';

  constructor(private readonly sessions: Pick<AuthSessions, 'verify'>) {}

  verify(payload: unknown): Promise<Principal | null> {
    return this.sessions.verify(payload);
  }
}

/** Cookie-only production building block: never falls back to the dev stub. */
export class SessionPrincipalResolver implements PrincipalResolver {
  constructor(private readonly strategy: SessionStrategy) {}

  resolve(from: Credentials): Promise<Principal | null> {
    // Resolution verifies only; running the auth flow here would create a new
    // session for every HTTP request and WebSocket handshake.
    return this.strategy.verify(from.cookies[AUTH_COOKIE]);
  }
}
