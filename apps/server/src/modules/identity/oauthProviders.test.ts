import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubOAuthClient, GoogleOAuthClient } from './oauthProviders.js';
import { githubProvider, googleProvider } from './oauthProviders.js';
import { OAuthStrategy } from './oauth.js';

const libraryPath = process.env['IDENTITY_ARCTIC_MODULE'];
it.skipIf(!libraryPath)(
  'identity: real Arctic adapters generate registered callbacks and Google S256 PKCE',
  async () => {
    const library = (await import(pathToFileURL(libraryPath!).href)) as {
      GitHub: new (id: string, secret: string, callback: string) => GitHubOAuthClient;
      Google: new (id: string, secret: string, callback: string) => GoogleOAuthClient;
    };
    const callback = 'https://lumen.example/api/auth/google/callback';
    const verifier = 'v'.repeat(43);
    const google = googleProvider(new library.Google('test-client', 'test-secret', callback));
    const url = google.authorizationURL('test-state', verifier);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(callback);
    expect(url.searchParams.get('state')).toBe('test-state');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
    const github = githubProvider(
      new library.GitHub(
        'test-client',
        'test-secret',
        'https://lumen.example/api/auth/github/callback',
      ),
    );
    const githubURL = github.authorizationURL('test-state', verifier);
    expect(githubURL.origin).toBe('https://github.com');
    expect(githubURL.searchParams.get('state')).toBe('test-state');
    expect(githubURL.searchParams.get('scope')).toContain('user:email');
    expect(githubURL.href).not.toContain('test-secret');
  },
);

const token = 'provider-secret-token';
function transport(...responses: unknown[]): typeof fetch {
  const fetcher = vi.fn<typeof fetch>();
  for (const response of responses)
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
  return fetcher;
}
function github(fetcher: typeof fetch): ReturnType<typeof githubProvider> {
  return githubProvider(
    {
      createAuthorizationURL: () => new URL('https://github.com/login/oauth/authorize'),
      validateAuthorizationCode: () => Promise.resolve({ accessToken: () => token }),
    },
    fetcher,
  );
}
function google(fetcher: typeof fetch): ReturnType<typeof googleProvider> {
  return googleProvider(
    {
      createAuthorizationURL: () => new URL('https://accounts.google.com/o/oauth2/v2/auth'),
      validateAuthorizationCode: () => Promise.resolve({ accessToken: () => token }),
    },
    fetcher,
  );
}

describe('identity: OAuth provider adapters', () => {
  it('uses GitHub stable numeric identity and verified primary email, not public profile email', async () => {
    const fetcher = transport({ id: 123, login: 'handle', email: 'untrusted@example.test' }, [
      { primary: true, verified: true, email: 'verified@example.test' },
    ]);
    const result = await github(fetcher).profile('code', 'verifier');
    expect(result).toEqual({
      subject: '123',
      displayName: 'handle',
      email: 'verified@example.test',
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/user/emails',
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it.each([
    { emails: [{ primary: true, verified: false, email: 'x@example.test' }] },
    { emails: [{ primary: false, verified: true, email: 'x@example.test' }] },
    { emails: [] },
  ])('rejects GitHub without verified primary email: %j', async ({ emails }) => {
    await expect(
      github(transport({ id: 123 }, emails)).profile('code', 'verifier'),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('rejects invalid GitHub identity and provider HTTP errors', async () => {
    await expect(
      github(transport({ id: '123' }, [])).profile('code', 'verifier'),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private provider message', { status: 500 }));
    await expect(github(fetcher).profile('code', 'verifier')).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('uses Google authenticated userinfo with verified email and stable sub', async () => {
    expect(
      await google(
        transport({
          sub: 'google-subject',
          email: 'g@example.test',
          email_verified: true,
          name: 'Google User',
        }),
      ).profile('code', 'verifier'),
    ).toEqual({ subject: 'google-subject', email: 'g@example.test', displayName: 'Google User' });
  });

  it.each([false, 'true', undefined])(
    'rejects non-verified Google email (%s)',
    async (email_verified) => {
      await expect(
        google(transport({ sub: 'subject', email: 'g@example.test', email_verified })).profile(
          'code',
          'verifier',
        ),
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    },
  );

  it('passes state/scopes and Google PKCE verifier to the library', async () => {
    const create = vi.fn(() => new URL('https://accounts.google.com/authorize'));
    const exchange = vi.fn(() => Promise.resolve({ accessToken: () => token }));
    const provider = googleProvider(
      { createAuthorizationURL: create, validateAuthorizationCode: exchange },
      transport({ sub: 's', email: 'g@example.test', email_verified: true }),
    );
    provider.authorizationURL('state', 'verifier');
    await provider.profile('code', 'verifier');
    expect(create).toHaveBeenCalledWith('state', 'verifier', ['openid', 'email', 'profile']);
    expect(exchange).toHaveBeenCalledWith('code', 'verifier');
  });

  it('does not leak provider token-exchange errors', async () => {
    const provider = googleProvider({
      createAuthorizationURL: () => new URL('https://accounts.google.com/authorize'),
      validateAuthorizationCode: () => Promise.reject(new Error(token)),
    });
    await expect(provider.profile('code', 'verifier')).rejects.toThrow('Invalid credentials');
  });

  it('bounds a stalled provider token exchange and sanitizes the timeout', async () => {
    vi.useFakeTimers();
    try {
      const provider = githubProvider({
        createAuthorizationURL: () => new URL('https://github.com/login/oauth/authorize'),
        validateAuthorizationCode: () => new Promise(() => undefined),
      });
      const result = expect(provider.profile('code', 'verifier')).rejects.toThrow(
        'Invalid credentials',
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the OAuth strategy seam and refuses invalid strategy input', async () => {
    const profile = { subject: '1', email: 'g@example.test', displayName: 'User' };
    const accounts = { resolve: vi.fn().mockResolvedValue({ accountId: 'a', role: 'user' }) };
    const strategy = new OAuthStrategy(
      {
        kind: 'google',
        authorizationURL: () => new URL('https://accounts.google.com'),
        profile: () => Promise.resolve(profile),
      },
      accounts,
    );
    expect(await strategy.verify(null)).toBeNull();
    expect(await strategy.verify({ code: 1, verifier: 'v' })).toBeNull();
    expect(await strategy.verify({ code: 'c', verifier: 'v' })).toEqual({
      accountId: 'a',
      role: 'user',
    });
    expect(accounts.resolve).toHaveBeenCalledWith('google', profile);
  });
});
