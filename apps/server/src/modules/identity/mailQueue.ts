import { createHmac, randomBytes } from 'node:crypto';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type { MailSender } from './mail.js';
import { oauthHash } from './oauth.js';

export type MailPurpose = 'verify' | 'reset';
/** Value-free delivery telemetry: never an address, a code or a provider error. */
export type MailEvent =
  | 'admitted'
  | 'dropped'
  | 'sent'
  | 'retry'
  | 'failed'
  | 'ineligible'
  | 'error';

const PER_ADDRESS_PER_HOUR = 3;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_SECONDS = 30;

function report(event: ((e: MailEvent) => void) | undefined, e: MailEvent): void {
  try {
    event?.(e);
  } catch {
    // Optional telemetry must never change a response or stop the worker.
  }
}

export interface MailQueueOptions {
  /** HMAC key for the per-address index; at least 32 characters, server-only. */
  readonly key: string;
  readonly event?: (event: MailEvent) => void;
}

/**
 * Admission: the same statements for every well-formed address, and no account
 * lookup. Eligibility is decided later by MailWorker, so response time reveals nothing.
 */
export class MailQueue {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly options: MailQueueOptions,
  ) {
    if (typeof options.key !== 'string' || options.key.length < 32)
      throw new Error('Invalid mail queue key');
  }

  async admit(purpose: MailPurpose, email: string, accountId: string | null): Promise<void> {
    const emailKey = createHmac('sha256', this.options.key).update(email).digest('hex');
    const rows = await this.db.withTransaction(async (sql) => {
      // Serialize admissions per address, so concurrent requests cannot all pass the cap.
      await sql.query("select pg_advisory_xact_lock(hashtext('identity_mail'), hashtext($1))", [
        emailKey,
      ]);
      return sql.query<{ id: string }>(
        `insert into identity_mail_requests (purpose, email, email_key, account_id)
         select $1, $2, $3, $4
         where (select count(*) from identity_mail_requests
                where email_key = $3 and purpose = $1
                and requested_at > now() - interval '1 hour') < $5
         returning id`,
        [purpose, email, emailKey, accountId, PER_ADDRESS_PER_HOUR],
      );
    });
    report(this.options.event, rows.length ? 'admitted' : 'dropped');
  }
}

interface Claimed {
  readonly id: string;
  readonly purpose: MailPurpose;
  readonly email: string;
  readonly emailKey: string;
  readonly accountId: string | null;
  readonly attempts: number;
  readonly requestedAt: Date;
}
interface Account {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string | null;
}
interface Issued {
  readonly request: Claimed;
  readonly to: string;
  readonly token: string;
}

export interface MailWorkerOptions {
  readonly event?: (event: MailEvent) => void;
  /** Requests handled per tick. */
  readonly batch?: number;
}

/** Delivers admitted requests. Safe to run in several processes at once. */
export class MailWorker {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<unknown> = Promise.resolve();
  private stopped = true;
  /** Set by stop(): a tick in progress finishes its current request and returns. */
  private halting = false;

  constructor(
    private readonly db: IdentityDatabase,
    private readonly sender: MailSender,
    private readonly origin: string,
    private readonly options: MailWorkerOptions = {},
  ) {}

  /** Handles due requests, then removes finished requests and expired codes. */
  async tick(): Promise<void> {
    const batch = this.options.batch ?? 20;
    for (let handled = 0; handled < batch && !this.halting; handled++) {
      const issued = await this.claim();
      if (issued === null) break;
      if (issued !== 'skipped') await this.deliver(issued);
    }
    await this.db.query(
      `delete from identity_mail_requests
       where state <> 'pending' and requested_at < now() - interval '24 hours'`,
      [],
    );
    await this.db.query('delete from identity_mail_tokens where expires_at <= now()', []);
  }

  start(intervalMs = 2000): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.halting = false;
    const schedule = (): void => {
      if (this.stopped) return;
      const jitter = Math.floor(Math.random() * (intervalMs / 4));
      this.timer = setTimeout(() => {
        this.running = this.tick()
          .catch(() => report(this.options.event, 'error'))
          .finally(schedule);
      }, intervalMs + jitter);
    };
    schedule();
  }

  /** Stops scheduling and waits for the tick in progress. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.halting = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    await this.running;
  }

  /**
   * One request per transaction; every lock is released before any send. The
   * account is locked before the request row, the order suspension and every
   * credential change use, so a claim never deadlocks with them.
   */
  private claim(): Promise<Issued | 'skipped' | null> {
    return this.db.withTransaction(async (sql) => {
      const candidates = await sql.query<Claimed>(
        `select id, purpose, email, email_key as "emailKey", account_id as "accountId",
                attempts, requested_at as "requestedAt"
         from identity_mail_requests
         where state = 'pending' and not_before <= now()
         order by requested_at limit 1`,
        [],
      );
      const candidate = candidates[0];
      if (!candidate) return null;
      const account = await this.lockEligibleAccount(sql, candidate);
      const locked = await sql.query<{ attempts: number; stale: boolean }>(
        `select attempts, requested_at < now() - interval '1 hour' as stale
         from identity_mail_requests
         where id = $1 and state = 'pending' and not_before <= now()
         for update skip locked`,
        [candidate.id],
      );
      const request = locked[0];
      // Claimed by another worker, purged by suspension, or already leased.
      if (!request) return 'skipped';
      if (request.stale || request.attempts >= MAX_ATTEMPTS) {
        await sql.query(`update identity_mail_requests set state = 'failed' where id = $1`, [
          candidate.id,
        ]);
        report(this.options.event, 'failed');
        return 'skipped';
      }
      // The lease: a crash after commit makes the row due again after backoff.
      await sql.query(
        `update identity_mail_requests set attempts = attempts + 1,
         not_before = now() + make_interval(secs => $2 * power(2, attempts + 1))
         where id = $1`,
        [candidate.id, RETRY_BASE_SECONDS],
      );
      if (!account) {
        await sql.query(`update identity_mail_requests set state = 'done' where id = $1`, [
          candidate.id,
        ]);
        report(this.options.event, 'ineligible');
        return 'skipped';
      }
      const token = randomBytes(32).toString('base64url');
      await sql.query('delete from identity_mail_tokens where account_id = $1 and purpose = $2', [
        account.id,
        candidate.purpose,
      ]);
      await sql.query(
        `insert into identity_mail_tokens (token_hash, account_id, purpose, email, password_hash, expires_at)
         values ($1, $2, $3, $4, $5, now() + interval '15 minutes')`,
        [oauthHash(token), account.id, candidate.purpose, account.email, account.passwordHash],
      );
      return {
        request: { ...candidate, attempts: request.attempts + 1 },
        to: account.email,
        token,
      };
    });
  }

  /** Locks the account if it may receive this mail; a suspended account is not locked. */
  private async lockEligibleAccount(sql: IdentitySql, request: Claimed): Promise<Account | null> {
    if (request.purpose === 'verify') {
      const rows = await sql.query<{ id: string; email: string }>(
        'select id, email from accounts where id = $1 and email = $2 and not suspended for update',
        [request.accountId, request.email],
      );
      return rows[0] ? { ...rows[0], passwordHash: null } : null;
    }
    const rows = await sql.query<Account>(
      `select a.id, a.email, c.password_hash as "passwordHash"
       from accounts a join credentials c on c.account_id = a.id and c.kind = 'password'
       where lower(btrim(a.email)) = $1 and not a.suspended for update of a`,
      [request.email],
    );
    return rows[0] ?? null;
  }

  private async deliver({ request, to, token }: Issued): Promise<void> {
    const reset = request.purpose === 'reset';
    try {
      await this.sender.send({
        to,
        subject: reset ? 'Reset your lumen password' : 'Verify your lumen email',
        // The code is deliberately not in a URL: keep it out of access/referrer logs.
        text: `Open ${this.origin}/#/signin and choose Forgot password / email verification.\n\nYour ${reset ? 'password reset' : 'email verification'} code is:\n${token}\n\nIt expires in 15 minutes and can be used once. If you did not request this, ignore this email.`,
      });
    } catch {
      // An undelivered code must never work, even if the provider did deliver it.
      await this.db.query('delete from identity_mail_tokens where token_hash = $1', [
        oauthHash(token),
      ]);
      const final = request.attempts >= MAX_ATTEMPTS;
      if (final)
        await this.db.query(`update identity_mail_requests set state = 'failed' where id = $1`, [
          request.id,
        ]);
      report(this.options.event, final ? 'failed' : 'retry');
      return;
    }
    // Older pending requests for this address would only replace the code just sent.
    await this.db.query(
      `update identity_mail_requests set state = 'done'
       where state = 'pending' and email_key = $2 and purpose = $3
       and (id = $1 or requested_at <= $4)`,
      [request.id, request.emailKey, request.purpose, request.requestedAt],
    );
    report(this.options.event, 'sent');
  }
}
