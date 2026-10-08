import type { Db, Queryable } from '../../core/db/db.js';
import { badRequest, forbidden } from '../../core/http/httpError.js';
import type { SecretCipher } from './secretCipher.js';
import { UUID } from './validation.js';

export interface SecretMetadata {
  readonly provider: 'openai';
  readonly updatedAt: string;
}

function validateOwner(accountId: string, provider: string): void {
  if (!UUID.test(accountId) || provider !== 'openai')
    throw badRequest('invalid secret owner or provider');
}

/** Internal store only. Do not compose it until identity's deletion lifecycle is wired. */
export class Secrets {
  constructor(
    private readonly db: Db,
    private readonly cipher: SecretCipher,
    private readonly canUse: (accountId: string) => Promise<boolean>,
  ) {}

  private async eligible(accountId: string, provider = 'openai'): Promise<void> {
    validateOwner(accountId, provider);
    if (!(await this.canUse(accountId))) throw forbidden('account cannot use keys');
  }

  async list(accountId: string): Promise<readonly SecretMetadata[]> {
    await this.eligible(accountId);
    const rows = await this.db.query<{ provider: 'openai'; updated_at: Date }>(
      'select provider, updated_at from billing_secrets where account_id = $1 order by provider',
      [accountId],
    );
    return rows.map((row) => ({ provider: row.provider, updatedAt: row.updated_at.toISOString() }));
  }

  async put(accountId: string, provider: string, value: string): Promise<void> {
    await this.eligible(accountId, provider);
    const envelope = this.cipher.seal({ accountId, provider }, value);
    await this.db.query(
      `insert into billing_secrets (account_id, provider, envelope) values ($1, $2, $3::jsonb)
      on conflict (account_id, provider) do update set envelope = excluded.envelope, updated_at = now()`,
      [accountId, provider, JSON.stringify(envelope)],
    );
  }

  /** Only absence returns null; decryption and eligibility failures must never trigger fallback. */
  async secret(accountId: string, provider: string): Promise<string | null> {
    await this.eligible(accountId, provider);
    const [row] = await this.db.query<{ envelope: unknown }>(
      'select envelope from billing_secrets where account_id = $1 and provider = $2',
      [accountId, provider],
    );
    return row ? this.cipher.open({ accountId, provider }, row.envelope) : null;
  }

  /** The caller must authenticate the owner; suspension must not prevent removal (#78). */
  async remove(accountId: string, provider: string): Promise<void> {
    validateOwner(accountId, provider);
    await this.db.query('delete from billing_secrets where account_id = $1 and provider = $2', [
      accountId,
      provider,
    ]);
  }

  /** Proposed deletion-hook primitive; the caller owns authorization and the transaction. */
  async eraseAccount(accountId: string, tx: Queryable): Promise<void> {
    if (!UUID.test(accountId)) throw badRequest('invalid secret owner');
    await tx.query('delete from billing_secrets where account_id = $1', [accountId]);
  }
}
