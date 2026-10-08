import type { AccountDeletionParticipant } from './accountLifecycle.js';
import { AuthFailure } from './authFlow.js';
import type { IdentityDatabase, IdentitySql } from './identityDatabase.js';
import type { OAuthKind, OAuthProfile } from './oauth.js';
import { DUMMY_PASSWORD_HASH, isBoundedPassword, verifyPassword } from './passwordHash.js';

/** Fresh, action-specific authentication. Never resolves or issues a login session. */
export class KeyRemoval {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly remove: AccountDeletionParticipant,
  ) {}

  async password(input: unknown): Promise<void> {
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'email' && key !== 'password') ||
      !('email' in input) ||
      typeof input.email !== 'string' ||
      !input.email.trim() ||
      input.email.length > 320 ||
      !('password' in input) ||
      typeof input.password !== 'string' ||
      !isBoundedPassword(input.password)
    )
      throw new AuthFailure('invalid_credentials');
    const email = input.email.trim().toLowerCase();
    const [proof] = await this.db.query<{ id: string; hash: string }>(
      `select a.id, c.password_hash as hash from accounts a join credentials c on c.account_id = a.id
       where lower(btrim(a.email)) = $1 and a.deleted_at is null and c.kind = 'password'`,
      [email],
    );
    const matches = await verifyPassword(input.password, proof?.hash ?? DUMMY_PASSWORD_HASH);
    if (!proof || !matches) throw new AuthFailure('invalid_credentials');
    await this.db.withTransaction(async (tx) => {
      await this.lock(tx, proof.id);
      const [current] = await tx.query<{ hash: string }>(
        `select c.password_hash as hash from credentials c join accounts a on a.id = c.account_id
         where c.account_id = $1 and c.kind = 'password' and lower(btrim(a.email)) = $2`,
        [proof.id, email],
      );
      if (current?.hash !== proof.hash) throw new AuthFailure('invalid_credentials');
      await this.remove(proof.id, tx);
    });
  }

  /** Called only after a purpose-bound one-use OAuth attempt and fresh exchange. */
  async oauth(kind: OAuthKind, profile: OAuthProfile): Promise<void> {
    if (!['github', 'google'].includes(kind) || !profile.subject || profile.subject.length > 255)
      throw new AuthFailure('invalid_credentials');
    // Email is deliberately ignored: only an existing immutable provider subject can prove ownership.
    const [proof] = await this.db.query<{ id: string }>(
      `select account_id as id from credentials
       where kind = $1 and external_provider = $1 and external_id = $2`,
      [kind, profile.subject],
    );
    if (!proof) throw new AuthFailure('invalid_credentials');
    await this.db.withTransaction(async (tx) => {
      await this.lock(tx, proof.id);
      const rows = await tx.query(
        `select id from credentials where account_id = $1 and kind = $2
         and external_provider = $2 and external_id = $3`,
        [proof.id, kind, profile.subject],
      );
      if (rows.length !== 1) throw new AuthFailure('invalid_credentials');
      await this.remove(proof.id, tx);
    });
  }

  private async lock(tx: IdentitySql, id: string): Promise<void> {
    const rows = await tx.query(
      'select id from accounts where id = $1 and deleted_at is null for update',
      [id],
    );
    if (rows.length !== 1) throw new AuthFailure('invalid_credentials');
  }
}
