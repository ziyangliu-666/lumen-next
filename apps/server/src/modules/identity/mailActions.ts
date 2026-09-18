import { randomBytes } from 'node:crypto';
import { AccountFailure } from './accounts.js';
import { newPasswordOf } from './accountService.js';
import { AuthFailure } from './authFlow.js';
import type { IdentityDatabase } from './identityDatabase.js';
import type { MailSender } from './mail.js';
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
    private readonly sender: MailSender,
    private readonly origin: string,
    private readonly deliveryFailed: () => void = () => undefined,
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

  async requestReset(emailInput: unknown): Promise<void> {
    if (
      typeof emailInput !== 'string' ||
      emailInput.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())
    ) {
      throw new AccountFailure('invalid_body', 'Enter a valid email address');
    }
    const rows = await this.db.query<{ id: string }>(
      `select a.id from accounts a join credentials c on c.account_id = a.id
       and c.kind = 'password' where lower(btrim(a.email)) = $1 and not a.suspended`,
      [emailInput.trim().toLowerCase()],
    );
    if (rows[0]) await this.issue(rows[0].id, 'reset');
  }

  async requestVerification(accountId: string): Promise<void> {
    await this.issue(accountId, 'verify');
  }

  private async issue(accountId: string, purpose: 'verify' | 'reset'): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const issued = await this.db.withTransaction(async (sql) => {
      const accounts = await sql.query<{ email: string }>(
        'select email from accounts where id = $1 and not suspended for update',
        [accountId],
      );
      const account = accounts[0];
      if (!account) return null;
      const hashes = await sql.query<{ passwordHash: string }>(
        `select password_hash as "passwordHash" from credentials where account_id = $1 and kind = 'password'`,
        [accountId],
      );
      if (purpose === 'reset' && !hashes[0]) return null;
      await sql.query(
        'delete from identity_mail_tokens where expires_at <= now() or (account_id = $1 and purpose = $2)',
        [accountId, purpose],
      );
      await sql.query(
        `insert into identity_mail_tokens (token_hash, account_id, purpose, email, password_hash, expires_at)
         values ($1, $2, $3, $4, $5, now() + interval '15 minutes')`,
        [
          oauthHash(token),
          accountId,
          purpose,
          account.email,
          purpose === 'reset' ? hashes[0]!.passwordHash : null,
        ],
      );
      return account;
    });
    if (!issued) return;
    try {
      await this.sender.send({
        to: issued.email,
        subject: purpose === 'reset' ? 'Reset your lumen password' : 'Verify your lumen email',
        // The code is deliberately not in a URL: keep it out of access/referrer logs.
        text: `Open ${this.origin}/#/signin and choose Forgot password / email verification.\n\nYour ${purpose === 'reset' ? 'password reset' : 'email verification'} code is:\n${token}\n\nIt expires in 15 minutes and can be used once. If you did not request this, ignore this email.`,
      });
    } catch {
      // Public reset responses must not disclose whether an address is registered.
      // Report a value-free delivery metric, never addresses/tokens/provider errors.
      try {
        this.deliveryFailed();
      } catch {
        // Optional telemetry must not turn an eligible-address response into a 500.
      }
    }
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
