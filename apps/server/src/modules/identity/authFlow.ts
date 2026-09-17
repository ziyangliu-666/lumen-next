import type { Principal } from '../../core/http/authGuard.js';

/** A verifier owns input validation and proves identity, not session issuance. */
export interface AuthStrategy {
  readonly kind: string;
  verify(payload: unknown): Promise<Principal | null>;
}

export type AuthFailureCode = 'unsupported_kind' | 'invalid_credentials';

/** Domain failures are mapped to HTTP by routes, not by a provider strategy. */
export class AuthFailure extends Error {
  constructor(readonly code: AuthFailureCode) {
    super(
      code === 'invalid_credentials' ? 'Invalid credentials' : 'Unsupported authentication kind',
    );
    this.name = 'AuthFailure';
  }
}

/**
 * Strategy selects the varying proof; Template Method fixes the shared ending.
 * A production subclass persists a login session in onAuthenticated. Request
 * principal resolution calls its session verifier directly, without this hook:
 * checking a cookie must not issue a fresh login session on every request.
 */
export abstract class AbstractAuthFlow<Result> {
  private readonly strategies = new Map<string, AuthStrategy>();

  constructor(strategies: readonly AuthStrategy[]) {
    for (const strategy of strategies) {
      if (this.strategies.has(strategy.kind)) {
        throw new Error(`Duplicate authentication strategy: ${strategy.kind}`);
      }
      this.strategies.set(strategy.kind, strategy);
    }
  }

  /** Subclasses supply the completion hook, not a replacement algorithm. */
  async authenticate(kind: string, payload: unknown): Promise<Result> {
    const strategy = this.strategies.get(kind);
    if (!strategy) throw new AuthFailure('unsupported_kind');

    const principal = await strategy.verify(payload);
    if (!principal) throw new AuthFailure('invalid_credentials');

    return this.onAuthenticated(principal);
  }

  protected abstract onAuthenticated(principal: Principal): Promise<Result>;
}
