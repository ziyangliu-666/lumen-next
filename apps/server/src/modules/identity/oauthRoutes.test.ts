import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AuthFailure } from './authFlow.js';
import { LoginGate } from './loginGate.js';
import { OAuthAttempts } from './oauth.js';
import { identityRoutes } from './routes.js';

const servers: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of servers.splice(0)) await app.close();
});

async function setup(limit = 10): Promise<{
  app: FastifyInstance;
  consume: MockInstance<OAuthAttempts['consume']>;
  authenticate: ReturnType<typeof vi.fn>;
  logs: string[];
}> {
  const logs: string[] = [];
  const app = Fastify({
    logger: { level: 'info', stream: { write: (line: string) => logs.push(line) } },
  });
  servers.push(app);
  await app.register(cookie);
  const attempts = new OAuthAttempts({
    query: () => Promise.reject(new Error('Unexpected database access')),
    withTransaction: () => Promise.reject(new Error('Unexpected database access')),
  });
  const consume = vi.spyOn(attempts, 'consume').mockResolvedValue('test-verifier');
  const authenticate = vi.fn().mockResolvedValue({
    principal: { accountId: 'user', role: 'user' },
    token: 'new-session',
    expiresAt: Date.now() + 60_000,
  });
  await app.register(
    identityRoutes({
      origin: 'https://lumen.example',
      flow: { authenticate },
      sessions: {
        issue: () => Promise.reject(new Error('Unexpected signup')),
        revoke: () => Promise.resolve(),
        revokeAll: () => Promise.resolve(),
      },
      accounts: { getAccount: () => Promise.resolve(null) },
      management: {
        signup: () => Promise.reject(new Error('Unexpected signup')),
        update: () => Promise.reject(new Error('Unexpected update')),
        changePassword: () => Promise.resolve(),
        deleteAccount: () => Promise.reject(new Error('Unexpected deletion')),
      },
      loginGate: new LoginGate({ attempts: limit }),
      oauth: {
        attempts,
        providers: [
          {
            kind: 'google',
            authorizationURL: () => new URL('https://accounts.google.com/authorize'),
            profile: () => Promise.reject(new Error('Unexpected profile lookup')),
          },
        ],
      },
    }),
  );
  return { app, consume, authenticate, logs };
}
const url = '/api/auth/google/callback?state=private-state&code=private-provider-code';
const cookies = { lumen_oauth_google: 'private-binding', lumen_session: 'existing-session' };

describe('identity: OAuth callback admission and privacy without external tools', () => {
  it('bounds invalid callback database work before consuming an attempt', async () => {
    const fixture = await setup(1);
    fixture.consume.mockRejectedValue(new AuthFailure('invalid_credentials'));
    for (let index = 0; index < 3; index += 1) {
      const response = await fixture.app.inject({ url, cookies });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/?authError=oauth_failed#/signin');
      expect(response.cookies.some((entry) => entry.name === 'lumen_session')).toBe(false);
    }
    expect(fixture.consume).toHaveBeenCalledTimes(1);
    expect(fixture.authenticate).not.toHaveBeenCalled();
  });

  it('uses one admission slot for consume plus exchange and never logs callback secrets', async () => {
    const fixture = await setup(1);
    const response = await fixture.app.inject({ url, cookies });
    expect(response.headers.location).toBe('/#/home');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(fixture.consume).toHaveBeenCalledOnce();
    expect(fixture.authenticate).toHaveBeenCalledWith('google', {
      code: 'private-provider-code',
      verifier: 'test-verifier',
    });
    expect(response.cookies.find((entry) => entry.name === 'lumen_session')).toMatchObject({
      value: 'new-session',
      httpOnly: true,
      secure: true,
    });
    await fixture.app.inject({ url: '/api/auth/providers' });
    expect(fixture.logs.length).toBeGreaterThan(0);
    expect(fixture.logs.join('')).not.toMatch(
      /private-state|private-provider-code|private-binding/,
    );
    // Successful exchanges do not consume failure capacity. The fixture's
    // consume is a mock; real one-use/replay behavior is tested in oauthEngine.
    const next = await fixture.app.inject({ url, cookies });
    expect(next.headers.location).toBe('/#/home');
    expect(fixture.consume).toHaveBeenCalledTimes(2);
    expect(fixture.authenticate).toHaveBeenCalledTimes(2);
  });

  it.each(['code=a&code=b', 'error=access_denied&code=unused', 'code=', ''])(
    'rejects malformed or denied callbacks without exchanging credentials: %s',
    async (query) => {
      const fixture = await setup();
      const response = await fixture.app.inject({
        url: `/api/auth/google/callback?state=private-state&${query}`,
        cookies,
      });
      expect(response.headers.location).toBe('/?authError=oauth_failed#/signin');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(fixture.consume).toHaveBeenCalledOnce();
      expect(fixture.authenticate).not.toHaveBeenCalled();
      expect(response.cookies.some((entry) => entry.name === 'lumen_session')).toBe(false);
    },
  );
});
