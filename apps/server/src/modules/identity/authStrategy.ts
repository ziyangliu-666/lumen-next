import type { Principal } from '../../core/http/authGuard.js';

// Strategy: one interface, one implementation per way in.
export interface Credentials {
  readonly kind: 'github' | 'google' | 'password' | 'session';
  readonly payload: Record<string, string>;
}

export interface AuthStrategy {
  readonly kind: Credentials['kind'];
  verify(payload: Record<string, string>): Promise<Principal | null>;
}

// Template Method: the flow is fixed (find strategy -> verify -> issue session);
// only verify() varies. A fifth way in is a new AuthStrategy, nothing else.
export abstract class AbstractAuthFlow {
  protected abstract strategies(): readonly AuthStrategy[];

  async authenticate(creds: Credentials): Promise<Principal | null> {
    const strategy = this.strategies().find((s) => s.kind === creds.kind);
    if (!strategy) return null;
    const principal = await strategy.verify(creds.payload);
    if (!principal) return null;
    return this.onAuthenticated(principal);
  }

  // Hook: issue a session, write a login record. Overridden in production.
  protected onAuthenticated(principal: Principal): Principal {
    return principal;
  }
}
