import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitAuthentication, type AuthSubmission } from './authClient';

const fetchMock = vi.fn<typeof fetch>();
const dispatchEvent = vi.fn();
const signin: AuthSubmission = {
  mode: 'signin',
  email: 'local@example.test',
  password: 'local-test-password',
};
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { dispatchEvent });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe('Authentication refreshes a persistent shell', () => {
  it.each(['signin', 'signup'] as const)(
    'announces successful %s only after validating the response',
    async (mode) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ accountId: 'alice', role: 'user' })),
      );
      const input: AuthSubmission =
        mode === 'signup' ? { ...signin, mode, displayName: 'Alice' } : signin;
      expect(await submitAuthentication(input)).toEqual({ accountId: 'alice', role: 'user' });
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect((dispatchEvent.mock.calls[0]?.[0] as Event).type).toBe('lumen:auth-changed');
    },
  );
  it.each([401, 500])('does not announce rejected HTTP %s authentication', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(submitAuthentication(signin)).rejects.toThrow();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
  it('does not announce an invalid success body', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    await expect(submitAuthentication(signin)).rejects.toThrow('invalid sign-in response');
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
