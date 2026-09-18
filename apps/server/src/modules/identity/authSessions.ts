import { createHash, randomBytes } from 'node:crypto';
import type { Principal } from '../../core/http/authGuard.js';
import type { VerifiedPrincipal } from './authFlow.js';

export interface NewAuthSession {
  readonly accountId: string;
  readonly tokenHash: string;
  /** Recheck under the account lock; this proof must not be stored in auth_sessions. */
  readonly expectedPasswordHash?: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface StoredAuthSession {
  /** Joined from the current account, not a role cached at sign-in. */
  readonly principal: Principal;
  readonly suspended: boolean;
  readonly expiresAt: number;
}

/** Durable adapters must enforce token uniqueness, join live accounts and atomically check proof versions. */
export interface AuthSessionStore {
  insert(session: NewAuthSession): Promise<void>;
  /** Null for unknown, deleted/revoked sessions or deleted accounts. */
  findByTokenHash(hash: string): Promise<StoredAuthSession | null>;
  deleteByTokenHash(hash: string): Promise<void>;
  deleteByAccountId(accountId: string): Promise<void>;
}

export interface IssuedAuthSession {
  readonly principal: Principal;
  /** Bearer secret: return only to cookie-setting code, never logs or storage. */
  readonly token: string;
  readonly expiresAt: number;
}

function tokenHash(token: unknown): string | null {
  if (typeof token !== 'string' || token.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }
  // Reject alternate encodings of the same bytes rather than giving one token
  // multiple textual identities in lookup/revocation paths.
  if (Buffer.from(token, 'base64url').toString('base64url') !== token) return null;
  return createHash('sha256').update(token).digest('hex');
}

function timestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid session timestamp');
  return value;
}

export class AuthSessions {
  private readonly now: () => number;
  private readonly lifetimeMs: number;

  constructor(
    private readonly store: AuthSessionStore,
    options: { readonly lifetimeMs: number; readonly now?: () => number },
  ) {
    if (!Number.isSafeInteger(options.lifetimeMs) || options.lifetimeMs <= 0) {
      throw new Error('Invalid session lifetime');
    }
    this.lifetimeMs = options.lifetimeMs;
    this.now = options.now ?? Date.now;
  }

  async issue(verified: VerifiedPrincipal): Promise<IssuedAuthSession> {
    // Explicit projection keeps strategy proof metadata out of JSON/cookies/logs.
    const principal: Principal = { accountId: verified.accountId, role: verified.role };
    const createdAt = timestamp(this.now());
    const expiresAt = timestamp(createdAt + this.lifetimeMs);
    const token = randomBytes(32).toString('base64url');
    await this.store.insert({
      accountId: principal.accountId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      ...(verified.expectedPasswordHash === undefined
        ? {}
        : { expectedPasswordHash: verified.expectedPasswordHash }),
      createdAt,
      expiresAt,
    });
    return { principal, token, expiresAt };
  }

  async verify(token: unknown): Promise<Principal | null> {
    const hash = tokenHash(token);
    if (!hash) return null;
    const session = await this.store.findByTokenHash(hash);
    const now = timestamp(this.now());
    if (
      !session ||
      session.suspended ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt <= now
    ) {
      return null;
    }
    return session.principal;
  }

  async revoke(token: unknown): Promise<void> {
    const hash = tokenHash(token);
    if (hash) await this.store.deleteByTokenHash(hash);
  }

  async revokeAll(accountId: string): Promise<void> {
    await this.store.deleteByAccountId(accountId);
  }
}
