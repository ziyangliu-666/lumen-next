import { describe, expect, it, vi } from 'vitest';
import { AccountRequestError, type accountRequest } from './accountClient';
import { deleteOwnAccount } from './accountDeletion';

function setup(result?: Error): {
  send: ReturnType<typeof vi.fn<typeof accountRequest>>;
  onDeleted: ReturnType<typeof vi.fn<() => void>>;
} {
  const send = vi.fn<typeof accountRequest>();
  if (result) send.mockRejectedValue(result);
  else send.mockResolvedValue(null);
  return { send, onDeleted: vi.fn<() => void>() };
}

describe('Account deletion', () => {
  it('sends nothing until the irreversible step is confirmed', async () => {
    const { send, onDeleted } = setup();
    expect(
      await deleteOwnAccount({ confirmed: false, currentPassword: 'secret pass' }, onDeleted, send),
    ).toMatch(/confirm/i);
    expect(send).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('sends the current password and leaves for sign-in once the account is gone', async () => {
    const { send, onDeleted } = setup();
    expect(
      await deleteOwnAccount({ confirmed: true, currentPassword: 'secret pass' }, onDeleted, send),
    ).toBeNull();
    expect(send).toHaveBeenCalledWith('/api/me', 'DELETE', { currentPassword: 'secret pass' });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('sends no password for an account that signs in only with a provider', async () => {
    const { send, onDeleted } = setup();
    await deleteOwnAccount({ confirmed: true, currentPassword: '' }, onDeleted, send);
    expect(send).toHaveBeenCalledWith('/api/me', 'DELETE', {});
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new AccountRequestError(401, 'x'), /Deletion refused.*sign in again.*10 minutes/],
    [new AccountRequestError(409, 'x'), /changed/],
    [new AccountRequestError(429, 'Too many attempts.'), /Too many attempts/],
    [new TypeError('offline'), /not deleted/],
  ])('shows why a refused deletion (%s) left the account in place', async (failure, message) => {
    const { send, onDeleted } = setup(failure);
    expect(
      await deleteOwnAccount({ confirmed: true, currentPassword: 'wrong' }, onDeleted, send),
    ).toMatch(message);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
