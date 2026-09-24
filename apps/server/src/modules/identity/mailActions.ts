import { AccountFailure } from './accounts.js';
import { newPasswordOf } from './accountService.js';
import { AuthFailure } from './authFlow.js';
import type { IdentityDatabase } from './identityDatabase.js';
import type { MailQueue } from './mailQueue.js';
import { oauthHash } from './oauth.js';
import { hashPassword } from './passwordHash.js';

function invalidToken(): AccountFailure {
  return new AccountFailure('invalid_body', 'Invalid or expired code');
}
function tokenHash(input: unknown): string {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input)) throw invalidToken();
  return oauthHash(input);
}
interface TokenRow {
  readonly accountId: string;
  readonly email: string;
  readonly passwordHash: string | null;
}

/** Mail codes are single-use, purpose-bound and never returned by HTTP. */
export class MailActions {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly queue: MailQueue,
  ) {}

  async status(accountId: string): Promise<{ verified: boolean }> {
    const rows = await this.db.query<{ verified: boolean }>(
      `select exists(select 1 from identity_email_verifications v
       where v.account_id = a.id and v.email = a.email) as verified
       from accounts a where a.id = $1 and not a.suspended`,
      [accountId],
    );
    if (!rows[0]) throw new AuthFailure('invalid_credentials');
    return rows[0];
  }

  /** Admission only: the worker decides eligibility, so every address costs the same. */
  async requestReset(emailInput: unknown): Promise<void> {
    if (
      typeof emailInput !== 'string' ||
      emailInput.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())
    ) {
      throw new AccountFailure('invalid_body', 'Enter a valid email address');
    }
    await this.queue.admit('reset', emailInput.trim().toLowerCase(), null);
  }

  /** Authenticated, so looking the account up first reveals nothing new. */
  async requestVerification(accountId: string): Promise<void> {
    const rows = await this.db.query<{ email: string }>(
      'select email from accounts where id = $1 and not suspended',
      [accountId],
    );
    if (!rows[0]) throw new AuthFailure('invalid_credentials');
    await this.queue.admit('verify', rows[0].email, accountId);
  }

  async verifyEmail(accountId: string, code: unknown): Promise<void> {
    await this.consume(tokenHash(code), 'verify', accountId);
  }

  async resetPassword(code: unknown, password: unknown): Promise<void> {
    const hash = tokenHash(code);
    const next = newPasswordOf(password);
    // Cheap existence check before scrypt; still rechecked under locks below.
    const tokens = await this.db.query(
      'select token_hash from identity_mail_tokens where token_hash = $1 and purpose = $2 and expires_at > now()',
      [hash, 'reset'],
    );
    if (!tokens.length) throw invalidToken();
    await this.consume(hash, 'reset', undefined, await hashPassword(next));
  }

  private async consume(
    hash: string,
    purpose: 'verify' | 'reset',
    expectedAccount?: string,
    nextHash?: string,
  ): Promise<void> {
    const candidates = await this.db.query<TokenRow>(
      `select account_id as "accountId", email, password_hash as "passwordHash"
       from identity_mail_tokens where token_hash = $1 and purpose = $2 and expires_at > now()`,
      [hash, purpose],
    );
    const candidate = candidates[0];
    if (!candidate || (expectedAccount !== undefined && expectedAccount !== candidate.accountId))
      throw invalidToken();
    await this.db.withTransaction(async (sql) => {
      // Same account-first lock order as credential changes, suspension and deletion.
      const active = await sql.query<{ email: string }>(
        'select email from accounts where id = $1 and not suspended for update',
        [candidate.accountId],
      );
      if (active[0]?.email !== candidate.email) throw invalidToken();
      const consumed = await sql.query(
        'delete from identity_mail_tokens where token_hash = $1 and purpose = $2 and expires_at > now() returning token_hash',
        [hash, purpose],
      );
      if (!consumed.length) throw invalidToken();
      if (purpose === 'verify') {
        await sql.query(
          `insert into identity_email_verifications (account_id, email) values ($1, $2)
           on conflict (account_id) do update set email = excluded.email, verified_at = now()`,
          [candidate.accountId, candidate.email],
        );
      } else {
        const changed = await sql.query(
          `update credentials set password_hash = $3 where account_id = $1 and kind = 'password'
           and password_hash = $2 returning id`,
          [candidate.accountId, candidate.passwordHash, nextHash],
        );
        if (changed.length !== 1) throw invalidToken();
        await sql.query('delete from auth_sessions where account_id = $1', [candidate.accountId]);
        await sql.query(
          "delete from identity_mail_tokens where account_id = $1 and purpose = 'reset'",
          [candidate.accountId],
        );
      }
    });
  }
}
