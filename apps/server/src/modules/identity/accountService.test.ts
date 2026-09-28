import { createHash } from 'node:crypto';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { AccountService, newPasswordOf, RECENT_SIGN_IN_MS } from './accountService.js';
import { AccountFailure, type AccountStore, type AccountView } from './accounts.js';
import type { PasswordAccount } from './passwordStrategy.js';

const account: AccountView = {
  id: 'a',
  email: 'a@example.edu',
  displayName: 'A',
  role: 'user',
  createdAt: 1000,
};
const password = 'a long test passphrase';
const credential: PasswordAccount = {
  principal: { accountId: 'a', role: 'user' },
  passwordHash: 'old-hash',
  suspended: false,
};
type MockStore = { [K in keyof AccountStore]: Mock<AccountStore[K]> };
function setup(): {
  store: MockStore;
  service: AccountService;
  hash: Mock<(text: string) => Promise<string>>;
  verify: Mock<(text: string, hash: string) => Promise<boolean>>;
} {
  const store: MockStore = {
    getAccount: vi.fn<AccountStore['getAccount']>().mockResolvedValue(account),
    createPasswordAccount: vi
      .fn<AccountStore['createPasswordAccount']>()
      .mockResolvedValue(account),
    getPasswordAccount: vi.fn<AccountStore['getPasswordAccount']>().mockResolvedValue(credential),
    updateAccount: vi.fn<AccountStore['updateAccount']>().mockResolvedValue(account),
    replacePassword: vi.fn<AccountStore['replacePassword']>().mockResolvedValue(true),
    deleteAccount: vi.fn<AccountStore['deleteAccount']>().mockResolvedValue(true),
  };
  const hash = vi.fn<(text: string) => Promise<string>>().mockResolvedValue('new-hash');
  const verify = vi.fn<(text: string, hash: string) => Promise<boolean>>().mockResolvedValue(true);
  return { store, service: new AccountService(store, { hash, verify }), hash, verify };
}

describe('identity: account self-service', () => {
  it('uses real scrypt by default without handing storage the raw password', async () => {
    const { store } = setup();
    const service = new AccountService(store);
    await service.signup({ email: account.email, displayName: 'A', password });
    const stored = store.createPasswordAccount.mock.calls[0]?.[0];
    expect(stored?.passwordHash).toMatch(/^scrypt\$v1\$/);
    expect(stored?.passwordHash).not.toContain(password);
  });

  it('refuses a store that promotes a newly registered account', async () => {
    const { store, service } = setup();
    store.createPasswordAccount.mockResolvedValueOnce({ ...account, role: 'staff' });
    await expect(
      service.signup({ email: account.email, displayName: 'A', password }),
    ).rejects.toThrow('signup role invariant');
  });

  it('normalizes signup fields and creates only a user with a hashed password', async () => {
    const { store, service, hash } = setup();
    await expect(
      service.signup({ email: ' A@Example.EDU ', displayName: ' A ', password }),
    ).resolves.toEqual(account);
    expect(hash).toHaveBeenCalledWith(password);
    expect(store.createPasswordAccount).toHaveBeenCalledWith({
      email: account.email,
      displayName: 'A',
      passwordHash: 'new-hash',
    });
  });

  it.each([
    null,
    [],
    {},
    { email: 'bad', displayName: 'A', password },
    { email: account.email, displayName: ' ', password },
    { email: account.email, displayName: 'A'.repeat(81), password },
    { email: account.email, displayName: 'A', password: 'short' },
    { email: account.email, displayName: 'A', password: '🔑'.repeat(257) },
    { email: account.email, displayName: 'A', password, role: 'staff' },
    { email: account.email, displayName: 'A', password: 123456789012345 },
  ])('rejects malformed or privilege-bearing signup input: %j', async (input) => {
    const { service, store, hash } = setup();
    await expect(service.signup(input)).rejects.toMatchObject({ code: 'invalid_body' });
    expect(hash).not.toHaveBeenCalled();
    expect(store.createPasswordAccount).not.toHaveBeenCalled();
  });

  it.each([8, 9, 14, 15, 16, 1024])('accepts a new ASCII password of %i characters', (length) => {
    expect(newPasswordOf('x'.repeat(length))).toBe('x'.repeat(length));
  });

  it.each(['x'.repeat(7), '🔑'.repeat(7), 'x'.repeat(1025), '🔑'.repeat(257)])(
    'rejects a password outside the character or UTF-8 byte bounds',
    (value) => {
      expect(() => newPasswordOf(value)).toThrow('Use at least 8 characters');
    },
  );

  it('counts new-password Unicode code points without trimming the secret', async () => {
    const { service, hash } = setup();
    await expect(
      service.signup({ email: account.email, displayName: 'A', password: '🔑'.repeat(7) }),
    ).rejects.toMatchObject({ code: 'invalid_body' });
    await service.signup({ email: account.email, displayName: 'A', password: '🔑'.repeat(8) });
    expect(hash).toHaveBeenCalledWith('🔑'.repeat(8));
    await service.signup({ email: account.email, displayName: 'A', password: ' 🔑'.repeat(4) });
    expect(hash).toHaveBeenCalledWith(' 🔑'.repeat(4));
  });

  it('accepts eight-character passwords for signup and password changes', async () => {
    const { service, hash, store } = setup();
    const next = 'testpass';
    await service.signup({ email: account.email, displayName: 'A', password: next });
    await service.changePassword('a', { currentPassword: password, newPassword: next });
    expect(hash).toHaveBeenCalledWith(next);
    expect(store.replacePassword).toHaveBeenCalledWith('a', 'old-hash', 'new-hash', undefined);
  });

  it('preserves uniqueness and infrastructure failures from atomic account creation', async () => {
    const { service, store } = setup();
    const conflict = new AccountFailure('email_taken', 'Email is already registered');
    store.createPasswordAccount.mockRejectedValueOnce(conflict);
    await expect(service.signup({ email: account.email, displayName: 'A', password })).rejects.toBe(
      conflict,
    );
    const failure = new Error('storage unavailable');
    store.createPasswordAccount.mockRejectedValueOnce(failure);
    await expect(service.signup({ email: account.email, displayName: 'A', password })).rejects.toBe(
      failure,
    );
  });

  it('updates a name without asking for a password', async () => {
    const { service, store, verify } = setup();
    await service.update('a', { displayName: ' Renamed ' });
    expect(store.updateAccount).toHaveBeenCalledWith({
      accountId: 'a',
      patch: { displayName: 'Renamed' },
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('reauthenticates email changes and passes the verified hash for atomic comparison', async () => {
    const { service, store, verify } = setup();
    await service.update('a', { email: ' NEW@Example.edu ', currentPassword: password });
    expect(verify).toHaveBeenCalledWith(password, 'old-hash');
    expect(store.updateAccount).toHaveBeenCalledWith({
      accountId: 'a',
      patch: { email: 'new@example.edu' },
      expectedPasswordHash: 'old-hash',
    });
  });

  it.each([
    {},
    { role: 'staff' },
    { accountId: 'other', displayName: 'A' },
    { email: 'bad' },
    { displayName: '' },
  ])('rejects invalid account patches: %j', async (input) => {
    const { service, store } = setup();
    await expect(service.update('a', input)).rejects.toMatchObject({ code: 'invalid_body' });
    expect(store.updateAccount).not.toHaveBeenCalled();
  });

  it('cannot change email with an incorrect or missing password', async () => {
    const { service, store, verify } = setup();
    verify.mockResolvedValue(false);
    await expect(
      service.update('a', { email: 'new@example.edu', currentPassword: 'wrong' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(service.update('a', { email: 'new@example.edu' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(store.updateAccount).not.toHaveBeenCalled();
  });

  it.each([null, { ...credential, passwordHash: null }, { ...credential, suspended: true }])(
    'refuses password changes for unavailable or password-less accounts',
    async (record) => {
      const { service, store } = setup();
      store.getPasswordAccount.mockResolvedValue(record);
      await expect(
        service.changePassword('a', { currentPassword: password, newPassword: password }),
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
      expect(store.replacePassword).not.toHaveBeenCalled();
    },
  );

  it('hashes a new password only after the current password is verified', async () => {
    const { service, store, verify, hash } = setup();
    await service.changePassword('a', { currentPassword: ' old secret ', newPassword: password });
    expect(verify).toHaveBeenCalledWith(' old secret ', 'old-hash');
    expect(hash).toHaveBeenCalledWith(password);
    expect(store.replacePassword).toHaveBeenCalledWith('a', 'old-hash', 'new-hash', undefined);
    verify.mockResolvedValueOnce(false);
    hash.mockClear();
    await expect(
      service.changePassword('a', { currentPassword: 'wrong', newPassword: password }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(hash).not.toHaveBeenCalled();
  });

  it('does not overwrite a concurrent password change or stale email-change proof', async () => {
    const { service, store } = setup();
    store.replacePassword.mockResolvedValue(false);
    store.updateAccount.mockResolvedValue(null);
    await expect(
      service.changePassword('a', { currentPassword: password, newPassword: password }),
    ).rejects.toMatchObject({ code: 'account_changed' });
    await expect(
      service.update('a', { email: 'new@example.edu', currentPassword: password }),
    ).rejects.toMatchObject({ code: 'account_changed' });
  });

  it('rejects weak new passwords and caller-controlled ids before any read or write', async () => {
    const { service, store } = setup();
    await expect(
      service.changePassword('a', { currentPassword: password, newPassword: 'weak' }),
    ).rejects.toMatchObject({ code: 'invalid_body' });
    await expect(
      service.changePassword('a', {
        currentPassword: password,
        newPassword: password,
        accountId: 'other',
      }),
    ).rejects.toMatchObject({ code: 'invalid_body' });
    expect(store.getPasswordAccount).not.toHaveBeenCalled();
  });
});

describe('identity: account deletion reauthentication', () => {
  const token = 'A'.repeat(43);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  it('requires the current password of a password account and hands the verified hash on', async () => {
    const { service, store, verify } = setup();
    await service.deleteAccount('a', { currentPassword: password }, token);
    expect(verify).toHaveBeenCalledWith(password, 'old-hash');
    expect(store.deleteAccount).toHaveBeenCalledWith('a', {
      kind: 'password',
      expectedHash: 'old-hash',
    });
  });

  it.each([
    ['a wrong password', { currentPassword: 'wrong' }],
    ['no password', {}],
    ['no body', undefined],
  ])('refuses %s without writing anything', async (_label, body) => {
    const { service, store, verify } = setup();
    verify.mockResolvedValue(false);
    await expect(service.deleteAccount('a', body, token)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(store.deleteAccount).not.toHaveBeenCalled();
  });

  it('refuses a body naming another account before reading anything', async () => {
    const { service, store } = setup();
    await expect(
      service.deleteAccount('a', { currentPassword: password, accountId: 'b' }, token),
    ).rejects.toMatchObject({ code: 'invalid_body' });
    expect(store.getPasswordAccount).not.toHaveBeenCalled();
    expect(store.deleteAccount).not.toHaveBeenCalled();
  });

  it('asks an account without a password for a sign-in within the last ten minutes', async () => {
    const { store } = setup();
    store.getPasswordAccount.mockResolvedValue({ ...credential, passwordHash: null });
    const service = new AccountService(store, undefined, () => 1_000_000_000);
    await service.deleteAccount('a', {}, token);
    expect(store.deleteAccount).toHaveBeenCalledWith('a', {
      kind: 'recent-session',
      tokenHash,
      issuedAfter: 1_000_000_000 - RECENT_SIGN_IN_MS,
    });
    expect(RECENT_SIGN_IN_MS).toBe(600_000);
  });

  it('refuses a stale sign-in, a missing cookie, or a password offered in place of one', async () => {
    const { store } = setup();
    store.getPasswordAccount.mockResolvedValue({ ...credential, passwordHash: null });
    const service = new AccountService(store);
    await expect(service.deleteAccount('a', {}, undefined)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(
      service.deleteAccount('a', { currentPassword: password }, token),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(store.deleteAccount).not.toHaveBeenCalled();
    store.deleteAccount.mockResolvedValue(false);
    await expect(service.deleteAccount('a', {}, token)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('reports a password changed under it as a conflict, and a suspended account as unauthenticated', async () => {
    const { service, store } = setup();
    store.deleteAccount.mockResolvedValue(false);
    await expect(
      service.deleteAccount('a', { currentPassword: password }, token),
    ).rejects.toMatchObject({ code: 'account_changed' });
    store.getPasswordAccount.mockResolvedValue({ ...credential, suspended: true });
    await expect(
      service.deleteAccount('a', { currentPassword: password }, token),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });
});
