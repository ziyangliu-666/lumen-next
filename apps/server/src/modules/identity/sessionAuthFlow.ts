import { AbstractAuthFlow, type AuthStrategy, type VerifiedPrincipal } from './authFlow.js';
import type { AuthSessions, IssuedAuthSession } from './authSessions.js';

/** Explicit sign-in completion, not per-request cookie resolution. */
export class SessionAuthFlow extends AbstractAuthFlow<IssuedAuthSession> {
  constructor(
    strategies: readonly AuthStrategy[],
    private readonly sessions: Pick<AuthSessions, 'issue'>,
  ) {
    super(strategies);
  }

  protected onAuthenticated(principal: VerifiedPrincipal): Promise<IssuedAuthSession> {
    return this.sessions.issue(principal);
  }
}
