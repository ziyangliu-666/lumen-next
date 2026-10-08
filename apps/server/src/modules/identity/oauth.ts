import { createHash, randomBytes } from 'node:crypto';
import type { Principal } from '../../core/http/authGuard.js';
import { AuthFailure, type AuthStrategy } from './authFlow.js';
import type { IdentityDatabase } from './identityDatabase.js';

export type OAuthKind = 'github' | 'google';
export interface OAuthProfile {
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
}
/** Token exchange is delegated to the reviewed OAuth library, not reimplemented. */
export interface OAuthProvider {
  readonly kind: OAuthKind;
  authorizationURL(state: string, verifier: string): URL;
  profile(code: string, verifier: string): Promise<OAuthProfile>;
}
export class OAuthEmailConflict extends Error {
  constructor() {
    super('Sign in with your existing method; automatic email linking is disabled');
    this.name = 'OAuthEmailConflict';
  }
}
export function oauthHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Server-side, one-use OAuth attempts, bound to a separate HttpOnly browser cookie. */
export class OAuthAttempts {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly purpose: 'signin' | 'key-removal' = 'signin',
  ) {}

  private hash(value: string): string {
    return oauthHash(this.purpose === 'signin' ? value : `key-removal:${value}`);
  }

  async begin(kind: OAuthKind): Promise<{ state: string; binding: string; verifier: string }> {
    const state = randomBytes(32).toString('base64url');
    const binding = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    await this.db.withTransaction(async (sql) => {
      await sql.query('delete from identity_oauth_attempts where expires_at <= now()', []);
      await sql.query(
        `insert into identity_oauth_attempts (state_hash, binding_hash, provider, verifier, expires_at)
         values ($1, $2, $3, $4, now() + interval '10 minutes')`,
        [this.hash(state), this.hash(binding), kind, verifier],
      );
    });
    return { state, binding, verifier };
  }

  async consume(kind: OAuthKind, state: unknown, binding: unknown): Promise<string> {
    if (
      typeof state !== 'string' ||
      typeof binding !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !/^[A-Za-z0-9_-]{43}$/.test(binding)
    ) {
      throw new AuthFailure('invalid_credentials');
    }
    const rows = await this.db.query<{ verifier: string }>(
      `delete from identity_oauth_attempts where state_hash = $1 and binding_hash = $2
       and provider = $3 and expires_at > now() returning verifier`,
      [this.hash(state), this.hash(binding), kind],
    );
    if (!rows[0]) throw new AuthFailure('invalid_credentials');
    return rows[0].verifier;
  }
}

export class OAuthAccounts {
  constructor(private readonly db: IdentityDatabase) {}

  async resolve(kind: OAuthKind, profile: OAuthProfile): Promise<Principal> {
    const email = profile.email.trim().toLowerCase();
    if (
      !profile.subject ||
      profile.subject.length > 255 ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      throw new AuthFailure('invalid_credentials');
    try {
      return await this.db.withTransaction(async (sql) => {
        // Serialize first login for the same external identity across connections.
        await sql.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `${kind}:${profile.subject}`,
        ]);
        const existing = await sql.query<Principal & { suspended: boolean }>(
          `select a.id as "accountId", a.role, a.suspended from accounts a join credentials c
           on c.account_id = a.id where c.kind = $1 and c.external_provider = $1 and c.external_id = $2`,
          [kind, profile.subject],
        );
        if (existing[0]) {
          if (existing[0].suspended) throw new AuthFailure('invalid_credentials');
          return { accountId: existing[0].accountId, role: existing[0].role };
        }
        // Never attach a provider to an existing account just because emails match.
        const collision = await sql.query(
          'select id from accounts where lower(btrim(email)) = $1',
          [email],
        );
        if (collision.length) throw new OAuthEmailConflict();
        const created = await sql.query<Principal>(
          `insert into accounts (email, display_name, role) values ($1, $2, 'user')
           returning id as "accountId", role`,
          [email, profile.displayName.trim().slice(0, 80) || email.split('@')[0]],
        );
        const principal = created[0];
        if (!principal) throw new Error('OAuth account insert returned no row');
        await sql.query(
          `insert into credentials (account_id, kind, external_provider, external_id)
           values ($1, $2, $2, $3)`,
          [principal.accountId, kind, profile.subject],
        );
        return { accountId: principal.accountId, role: principal.role };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        ['accounts_email_key', 'identity_accounts_email_normalized_key'].includes(
          String(error.constraint),
        )
      ) {
        throw new OAuthEmailConflict();
      }
      throw error;
    }
  }
}

/** Both OAuth strategies join the existing Template Method session-issuance hook. */
export class OAuthStrategy implements AuthStrategy {
  readonly kind: OAuthKind;
  constructor(
    private readonly provider: OAuthProvider,
    private readonly accounts: Pick<OAuthAccounts, 'resolve'>,
  ) {
    this.kind = provider.kind;
  }
  async verify(payload: unknown): Promise<Principal | null> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('code' in payload) ||
      !('verifier' in payload) ||
      typeof payload.code !== 'string' ||
      typeof payload.verifier !== 'string'
    )
      return null;
    return this.accounts.resolve(
      this.kind,
      await this.provider.profile(payload.code, payload.verifier),
    );
  }
}
