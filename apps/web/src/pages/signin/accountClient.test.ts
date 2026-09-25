import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountRequest, AccountRequestError } from './accountClient';

const fetchMock = vi.fn<typeof fetch>();
const dispatchEvent = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { dispatchEvent });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe('Account transport and shared auth invalidation', () => {
  it('reads without causing an account refresh loop', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'alice' })));
    expect(await accountRequest('/api/me', 'GET')).toEqual({ id: 'alice' });
    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
  it.each([
    ['/api/me', 'PATCH', 200],
    ['/api/me/password', 'POST', 204],
    ['/api/auth/signout', 'POST', 204],
    ['/api/auth/signout-all', 'POST', 204],
    ['/api/me', 'DELETE', 204],
  ] as const)('refreshes shared auth after successful %s', async (path, method, status) => {
    fetchMock.mockResolvedValue(new Response(status === 204 ? null : '{}', { status }));
    await accountRequest(path, method, { proof: 'test-only' });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0]?.[0] as Event).type).toBe('lumen:auth-changed');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"proof":"test-only"}');
  });
  it.each([401, 409, 429, 500])(
    'does not announce a successful mutation on HTTP %s',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      await expect(accountRequest('/api/me', 'PATCH', {})).rejects.toThrow();
      expect(dispatchEvent).not.toHaveBeenCalled();
    },
  );
  it('carries the HTTP status so a panel can word its own refusal', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const failure: unknown = await accountRequest('/api/me', 'DELETE', {}).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(AccountRequestError);
    expect((failure as AccountRequestError).status).toBe(401);
  });
  it('does not announce a mutation when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(accountRequest('/api/auth/signout', 'POST')).rejects.toThrow('offline');
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
