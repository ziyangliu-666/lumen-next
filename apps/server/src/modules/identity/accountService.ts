import { createHash } from 'node:crypto';
import { AuthFailure } from './authFlow.js';
import {
  AccountFailure,
  type AccountStore,
  type AccountView,
  type DeletionProof,
  type ProfilePatch,
} from './accounts.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isBoundedPassword,
  verifyPassword,
} from './passwordHash.js';

interface PasswordCodec {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

function bodyOf(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new AccountFailure('invalid_body', 'Expected an object');
  }
  if (Object.keys(input).some((key) => !fields.includes(key))) {
    throw new AccountFailure('invalid_body', 'Unexpected account field');
  }
  return input as Record<string, unknown>;
}

function emailOf(value: unknown): string {
  if (typeof value !== 'string' || value.length > 320) {
    throw new AccountFailure('invalid_body', 'Enter a valid email address');
  }
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountFailure('invalid_body', 'Enter a valid email address');
  }
  return email;
}

function nameOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    throw new AccountFailure('invalid_body', 'Name must contain 1 to 80 characters');
  }
  return value.trim();
}

export function newPasswordOf(value: unknown): string {
  if (typeof value !== 'string' || !isBoundedPassword(value) || [...value].length < 8) {
    throw new AccountFailure(
      'invalid_body',
      'Use at least 8 characters and at most 1024 UTF-8 bytes',
    );
  }
  return value;
}

/**
 * How recent a sign-in must be to delete an account that has no password.
 * Short enough that an unattended browser left signed in cannot be used to
 * delete the account; long enough to sign in again and confirm.
 */
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000;

function sessionTokenHash(token: string | undefined): string | undefined {
  return token === undefined ? undefined : createHash('sha256').update(token).digest('hex');
}

export class AccountService {
  constructor(
    private readonly store: AccountStore,
    private readonly passwords: PasswordCodec = { hash: hashPassword, verify: verifyPassword },
    private readonly now: () => number = Date.now,
  ) {}

  async signup(input: unknown): Promise<AccountView> {
    const body = bodyOf(input, ['email', 'displayName', 'password']);
    const email = emailOf(body['email']);
    const displayName = nameOf(body['displayName']);
    const password = newPasswordOf(body['password']);
    const passwordHash = await this.passwords.hash(password);
    const account = await this.store.createPasswordAccount({ email, displayName, passwordHash });
    if (account.role !== 'user') throw new Error('Account store violated signup role invariant');
    return account;
  }

  async update(accountId: string, input: unknown): Promise<AccountView> {
    const body = bodyOf(input, ['displayName', 'email', 'currentPassword']);
    if (!Object.hasOwn(body, 'displayName') && !Object.hasOwn(body, 'email')) {
      throw new AccountFailure('invalid_body', 'Provide a name or email to update');
    }
    const patch: ProfilePatch = {
      ...(Object.hasOwn(body, 'displayName') ? { displayName: nameOf(body['displayName']) } : {}),
      ...(Object.hasOwn(body, 'email') ? { email: emailOf(body['email']) } : {}),
    };
    const expectedPasswordHash =
      patch.email === undefined
        ? undefined
        : await this.currentHash(accountId, body['currentPassword']);
    const account = await this.store.updateAccount({
      accountId,
      patch,
      ...(expectedPasswordHash === undefined ? {} : { expectedPasswordHash }),
    });
    if (!account)
      throw new AccountFailure('account_changed', 'Account changed; sign in and try again');
    return account;
  }

  async changePassword(accountId: string, input: unknown, currentToken?: string): Promise<void> {
    const body = bodyOf(input, ['currentPassword', 'newPassword']);
    const next = newPasswordOf(body['newPassword']);
    const expectedHash = await this.currentHash(accountId, body['currentPassword']);
    const newHash = await this.passwords.hash(next);
    const keepTokenHash = sessionTokenHash(currentToken);
    if (!(await this.store.replacePassword(accountId, expectedHash, newHash, keepTokenHash))) {
      throw new AccountFailure('account_changed', 'Account changed; sign in and try again');
    }
    // The store changes the credential and revokes other sessions atomically.
  }

  /**
   * Immediate and irreversible. Reauthentication is the confirmation: the
   * current password for a password account, otherwise a sign-in within
   * RECENT_SIGN_IN_MS on the very session making the request.
   */
  async deleteAccount(accountId: string, input: unknown, currentToken?: string): Promise<void> {
    const body = bodyOf(input ?? {}, ['currentPassword']);
    const credential = await this.store.getPasswordAccount(accountId);
    if (!credential || credential.suspended) throw new AuthFailure('invalid_credentials');
    let proof: DeletionProof;
    if (credential.passwordHash) {
      proof = {
        kind: 'password',
        expectedHash: await this.currentHash(accountId, body['currentPassword']),
      };
    } else {
      const tokenHash = sessionTokenHash(currentToken);
      // A password offered for an account that has none proves nothing.
      if (tokenHash === undefined || Object.hasOwn(body, 'currentPassword')) {
        throw new AuthFailure('invalid_credentials');
      }
      proof = { kind: 'recent-session', tokenHash, issuedAfter: this.now() - RECENT_SIGN_IN_MS };
    }
    if (!(await this.store.deleteAccount(accountId, proof))) {
      if (proof.kind === 'recent-session') throw new AuthFailure('invalid_credentials');
      throw new AccountFailure('account_changed', 'Account changed; sign in and try again');
    }
  }

  private async currentHash(accountId: string, input: unknown): Promise<string> {
    if (typeof input !== 'string' || !isBoundedPassword(input)) {
      throw new AuthFailure('invalid_credentials');
    }
    const credential = await this.store.getPasswordAccount(accountId);
    const matches = await this.passwords.verify(
      input,
      credential?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!credential || credential.suspended || !credential.passwordHash || !matches) {
      throw new AuthFailure('invalid_credentials');
    }
    return credential.passwordHash;
  }
}
