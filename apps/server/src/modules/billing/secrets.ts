import { badRequest } from '../../core/http/httpError.js';
import type { SecretCipher } from './secretCipher.js';
import type { WithActiveSecretAccount } from './secretLifecycle.js';
import { UUID } from './validation.js';

export interface SecretMetadata {
  readonly provider: 'openai';
  readonly updatedAt: string;
}
function validateOwner(accountId: string, provider = 'openai'): void {
  if (!UUID.test(accountId) || provider !== 'openai')
    throw badRequest('invalid secret owner or provider');
}

/** No pool access: every read/write stays inside identity's account-lock transaction. */
export class Secrets {
  constructor(
    private readonly cipher: SecretCipher,
    private readonly withActiveAccount: WithActiveSecretAccount,
  ) {}

  async list(accountId: string): Promise<readonly SecretMetadata[]> {
    validateOwner(accountId);
    return this.withActiveAccount(accountId, async (tx) => {
      const rows = await tx.query<{ provider: 'openai'; updated_at: Date }>(
        'select provider, updated_at from billing_secrets where account_id = $1 order by provider',
        [accountId],
      );
      return rows.map((row) => ({
        provider: row.provider,
        updatedAt: row.updated_at.toISOString(),
      }));
    });
  }

  async put(accountId: string, provider: string, value: string): Promise<void> {
    validateOwner(accountId, provider);
    await this.withActiveAccount(accountId, async (tx) => {
      const envelope = this.cipher.seal({ accountId, provider }, value);
      await tx.query(
        `insert into billing_secrets (account_id, provider, envelope) values ($1, $2, $3::jsonb)
        on conflict (account_id, provider) do update set envelope = excluded.envelope, updated_at = now()`,
        [accountId, provider, JSON.stringify(envelope)],
      );
    });
  }

  /** Only absence returns null; identity, storage and crypto errors never trigger fallback. */
  async secret(accountId: string, provider: string): Promise<string | null> {
    validateOwner(accountId, provider);
    return this.withActiveAccount(accountId, async (tx) => {
      const [row] = await tx.query<{ envelope: unknown }>(
        'select envelope from billing_secrets where account_id = $1 and provider = $2',
        [accountId, provider],
      );
      // Decrypt before returning from work, while the account is still locked.
      return row ? this.cipher.open({ accountId, provider }, row.envelope) : null;
    });
  }
}
