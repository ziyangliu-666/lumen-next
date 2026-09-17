import type { Principal } from '../../core/http/authGuard.js';
import { AbstractAuthFlow, type AuthStrategy } from './authFlow.js';
import type { AuthSessions, IssuedAuthSession } from './authSessions.js';

/** Explicit sign-in completion, not per-request cookie resolution. */
export class SessionAuthFlow extends AbstractAuthFlow<IssuedAuthSession> {
  constructor(
    strategies: readonly AuthStrategy[],
    private readonly sessions: Pick<AuthSessions, 'issue'>,
  ) {
    super(strategies);
  }

  protected onAuthenticated(principal: Principal): Promise<IssuedAuthSession> {
    return this.sessions.issue(principal);
  }
}
