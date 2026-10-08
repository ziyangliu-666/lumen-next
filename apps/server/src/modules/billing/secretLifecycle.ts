import type { IdentitySql } from '../identity/index.js';
import { badRequest } from '../../core/http/httpError.js';
import { UUID } from './validation.js';

/** Identity owns the account lock, eligibility check, transaction and commit. */
export type WithActiveSecretAccount = <T>(
  accountId: string,
  work: (tx: IdentitySql) => Promise<T>,
) => Promise<T>;

function owner(accountId: string): void {
  if (!UUID.test(accountId)) throw badRequest('invalid secret owner');
}

/** Trusted deletion participant: identity must authenticate and lock the owner first. */
export async function eraseAccountSecrets(accountId: string, tx: IdentitySql): Promise<void> {
  owner(accountId);
  await tx.query('delete from billing_secrets where account_id = $1', [accountId]);
}

/** Trusted action-specific removal participant; no cipher or spending eligibility needed. */
export async function removeOwnOpenAiKey(accountId: string, tx: IdentitySql): Promise<void> {
  owner(accountId);
  await tx.query("delete from billing_secrets where account_id = $1 and provider = 'openai'", [
    accountId,
  ]);
}
