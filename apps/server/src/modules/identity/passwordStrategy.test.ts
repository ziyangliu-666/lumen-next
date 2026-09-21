import { describe, expect, it, vi, type Mock } from 'vitest';
import { PasswordStrategy, type PasswordAccount } from './passwordStrategy.js';
import { DUMMY_PASSWORD_HASH, hashPassword } from './passwordHash.js';

const account: PasswordAccount = {
  principal: { accountId: 'account-1', role: 'user' },
  passwordHash: 'stored-hash',
  suspended: false,
};

function setup(
  record: PasswordAccount | null = account,
  matches = true,
): {
  findByEmail: Mock<() => Promise<PasswordAccount | null>>;
  verify: Mock<() => Promise<boolean>>;
  strategy: PasswordStrategy;
} {
  const findByEmail = vi.fn(() => Promise.resolve(record));
  const verify = vi.fn(() => Promise.resolve(matches));
  return { findByEmail, verify, strategy: new PasswordStrategy({ findByEmail }, verify) };
}

describe('identity: password strategy', () => {
  it('normalizes the lookup email but never trims the password', async () => {
    const { strategy, findByEmail, verify } = setup();
    expect(strategy.kind).toBe('password');
    await expect(
      strategy.verify({ email: ' A@Example.edu ', password: '  secret  ' }),
    ).resolves.toEqual({ ...account.principal, expectedPasswordHash: account.passwordHash });
    expect(findByEmail).toHaveBeenCalledWith('a@example.edu');
    expect(verify).toHaveBeenCalledWith('  secret  ', 'stored-hash');
  });

  it.each([
    null,
    undefined,
    [],
    'password',
    {},
    { email: 123, password: 'secret' },
    { email: 'a@example.edu', password: 123 },
    { email: ' ', password: 'secret' },
    { email: 'a@example.edu', password: '' },
    { email: 'a@example.edu', password: 'x'.repeat(1025) },
    { email: 'x'.repeat(321), password: 'secret' },
  ])('rejects malformed credentials before querying storage: %j', async (payload) => {
    const { strategy, findByEmail, verify } = setup();
    await expect(strategy.verify(payload)).resolves.toBeNull();
    expect(findByEmail).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a wrong password without returning account information', async () => {
    const { strategy } = setup(account, false);
    await expect(
      strategy.verify({ email: 'a@example.edu', password: 'wrong' }),
    ).resolves.toBeNull();
  });

  it.each([null, { ...account, passwordHash: null }])(
    'does dummy password work for missing or OAuth-only accounts',
    async (record) => {
      const { strategy, verify } = setup(record);
      await expect(
        strategy.verify({ email: 'a@example.edu', password: 'secret' }),
      ).resolves.toBeNull();
      expect(verify).toHaveBeenCalledWith('secret', DUMMY_PASSWORD_HASH);
    },
  );

  it('rejects suspended accounts even when their password matches', async () => {
    const { strategy, verify } = setup({ ...account, suspended: true });
    await expect(
      strategy.verify({ email: 'a@example.edu', password: 'secret' }),
    ).resolves.toBeNull();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('preserves the stored staff role and ignores caller-supplied privileges', async () => {
    const staff = { ...account, principal: { accountId: 'staff-1', role: 'staff' as const } };
    const { strategy } = setup(staff);
    await expect(
      strategy.verify({ email: 'a@example.edu', password: 'secret', role: 'user' }),
    ).resolves.toEqual({ ...staff.principal, expectedPasswordHash: staff.passwordHash });
  });

  it('does not turn storage failure into credential rejection', async () => {
    const { strategy, findByEmail, verify } = setup();
    const failure = new Error('storage unavailable');
    findByEmail.mockRejectedValueOnce(failure);
    await expect(strategy.verify({ email: 'a@example.edu', password: 'secret' })).rejects.toBe(
      failure,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it('integrates with the real scrypt verifier by default', async () => {
    const passwordHash = await hashPassword('a real test password');
    const strategy = new PasswordStrategy({
      findByEmail: () => Promise.resolve({ ...account, passwordHash }),
    });
    await expect(
      strategy.verify({ email: 'a@example.edu', password: 'a real test password' }),
    ).resolves.toEqual({ ...account.principal, expectedPasswordHash: passwordHash });
    await expect(
      strategy.verify({ email: 'a@example.edu', password: 'wrong' }),
    ).resolves.toBeNull();
  });
});
