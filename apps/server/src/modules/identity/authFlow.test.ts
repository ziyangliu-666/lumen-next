import { describe, expect, it, vi, type Mock } from 'vitest';
import type { Principal } from '../../core/http/authGuard.js';
import { AbstractAuthFlow, AuthFailure } from './authFlow.js';

const principal: Principal = { accountId: 'account-1', role: 'user' };

class TestAuthFlow extends AbstractAuthFlow<Principal> {
  readonly complete = vi.fn((verified: Principal) => Promise.resolve(verified));

  protected onAuthenticated(verified: Principal): Promise<Principal> {
    return this.complete(verified);
  }
}

function strategy(
  kind: string,
  result: Principal | null = principal,
): { kind: string; verify: Mock<(payload: unknown) => Promise<Principal | null>> } {
  return { kind, verify: vi.fn(() => Promise.resolve(result)) };
}

describe('identity: authentication template', () => {
  it('verifies with only the selected strategy before completing once', async () => {
    const password = strategy('password');
    const github = strategy('github');
    const flow = new TestAuthFlow([password, github]);
    const payload = { email: 'a@example.edu', password: 'a secret' };

    await expect(flow.authenticate('password', payload)).resolves.toEqual(principal);
    expect(password.verify).toHaveBeenCalledTimes(1);
    expect(password.verify).toHaveBeenCalledWith(payload);
    expect(github.verify).not.toHaveBeenCalled();
    expect(flow.complete).toHaveBeenCalledTimes(1);
    expect(flow.complete).toHaveBeenCalledWith(principal);
    expect(vi.mocked(password.verify).mock.invocationCallOrder[0]).toBeLessThan(
      flow.complete.mock.invocationCallOrder[0]!,
    );
  });

  it('accepts a fifth strategy without changing the completion algorithm', async () => {
    const kinds = ['password', 'session', 'github', 'google', 'new-provider'];
    const flow = new TestAuthFlow(kinds.map((kind) => strategy(kind)));

    for (const kind of kinds) {
      await expect(flow.authenticate(kind, {})).resolves.toEqual(principal);
    }
    expect(flow.complete).toHaveBeenCalledTimes(5);
  });

  it('rejects unknown kinds without verification or completion', async () => {
    const password = strategy('password');
    const flow = new TestAuthFlow([password]);

    await expect(flow.authenticate('toString', {})).rejects.toMatchObject({
      code: 'unsupported_kind',
    });
    expect(password.verify).not.toHaveBeenCalled();
    expect(flow.complete).not.toHaveBeenCalled();
  });

  it('does not complete or fall back to another strategy after rejected credentials', async () => {
    const session = strategy('session');
    const flow = new TestAuthFlow([strategy('password', null), session]);

    await expect(flow.authenticate('password', null)).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'Invalid credentials',
    });
    expect(session.verify).not.toHaveBeenCalled();
    expect(flow.complete).not.toHaveBeenCalled();
  });

  it('propagates infrastructure errors without issuing a session', async () => {
    const failure = new Error('repository unavailable');
    const flow = new TestAuthFlow([
      { kind: 'password', verify: vi.fn(() => Promise.reject(failure)) },
    ]);

    await expect(flow.authenticate('password', {})).rejects.toBe(failure);
    expect(flow.complete).not.toHaveBeenCalled();
  });

  it('propagates completion failure rather than returning authentication success', async () => {
    const failure = new Error('session could not be persisted');
    const flow = new TestAuthFlow([strategy('password')]);
    flow.complete.mockRejectedValueOnce(failure);

    await expect(flow.authenticate('password', {})).rejects.toBe(failure);
    expect(flow.complete).toHaveBeenCalledTimes(1);
  });

  it('uses the same flow for staff without changing their role', async () => {
    const staff: Principal = { accountId: 'staff-1', role: 'staff' };
    const flow = new TestAuthFlow([strategy('password', staff)]);

    await expect(flow.authenticate('password', {})).resolves.toEqual(staff);
    expect(flow.complete).toHaveBeenCalledTimes(1);
    expect(flow.complete).toHaveBeenCalledWith(staff);
  });

  it('rejects duplicate kinds at construction instead of silently replacing a verifier', () => {
    expect(() => new TestAuthFlow([strategy('password'), strategy('password')])).toThrow(
      'Duplicate authentication strategy: password',
    );
  });

  it('exposes a domain failure independently of the HTTP error format', () => {
    const failure = new AuthFailure('invalid_credentials');
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('AuthFailure');
  });
});
