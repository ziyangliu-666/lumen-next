import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { oauthProvidersFromEnvironment } from './oauthConfiguration.js';

const origin = 'https://lumen.example';
const github = {
  GITHUB_OAUTH_CLIENT_ID: 'github-client',
  GITHUB_OAUTH_CLIENT_SECRET: 'github-private-secret',
};
const google = {
  GOOGLE_OAUTH_CLIENT_ID: 'google-client',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-private-secret',
};
afterEach(() => vi.unstubAllGlobals());

describe('identity: explicit OAuth environment configuration', () => {
  it('leaves both providers disabled when credentials are absent or empty', () => {
    expect(oauthProvidersFromEnvironment({}, origin)).toEqual([]);
    expect(
      oauthProvidersFromEnvironment(
        {
          GITHUB_OAUTH_CLIENT_ID: '',
          GITHUB_OAUTH_CLIENT_SECRET: '',
          GOOGLE_OAUTH_CLIENT_ID: '',
          GOOGLE_OAUTH_CLIENT_SECRET: '',
        },
        origin,
      ),
    ).toEqual([]);
  });
  it('does not read ambient process credentials', () => {
    vi.stubEnv('GITHUB_OAUTH_CLIENT_ID', 'ambient-client');
    vi.stubEnv('GITHUB_OAUTH_CLIENT_SECRET', 'ambient-secret');
    try {
      expect(oauthProvidersFromEnvironment({}, origin)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each([
    { GITHUB_OAUTH_CLIENT_ID: 'client' },
    { GITHUB_OAUTH_CLIENT_SECRET: 'private-secret' },
    { GOOGLE_OAUTH_CLIENT_ID: 'client' },
    { GOOGLE_OAUTH_CLIENT_SECRET: 'private-secret' },
    { ...github, GOOGLE_OAUTH_CLIENT_ID: 'client' },
  ])('rejects partial configuration without exposing values: %j', (environment) => {
    expect(() => oauthProvidersFromEnvironment(environment, origin)).toThrow(
      /OAuth requires both client ID and client secret/,
    );
    try {
      oauthProvidersFromEnvironment(environment, origin);
    } catch (error) {
      expect(String(error)).not.toContain('private-secret');
    }
  });
  it.each([' ', ' padded-secret', 'padded-secret ', 'secret\nvalue'])(
    'rejects malformed credentials without echoing them',
    (secret) => {
      expect(() =>
        oauthProvidersFromEnvironment({ ...github, GITHUB_OAUTH_CLIENT_SECRET: secret }, origin),
      ).toThrow('Invalid GitHub OAuth credentials');
    },
  );
  it.each([
    'http://lumen.example',
    'http://localhost:4000',
    'https://lumen.example/',
    'https://lumen.example/path',
    'https://lumen.example?secret=private',
    'https://user:private@lumen.example',
    'https://lumen.example#fragment',
    'not a URL',
    'https://LUMEN.example',
  ])('rejects a noncanonical or non-HTTPS callback origin', (badOrigin) => {
    expect(() => oauthProvidersFromEnvironment(github, badOrigin)).toThrow(
      'OAuth requires a canonical HTTPS origin',
    );
  });
  it.each(['http://localhost:4000', 'http://127.0.0.1:4000', 'http://[::1]:4000'])(
    'allows an explicitly opted-in canonical loopback origin: %s',
    (localOrigin) => {
      const providers = oauthProvidersFromEnvironment({ ...github, ...google }, localOrigin, {
        allowLoopbackHttp: true,
      });
      for (const provider of providers) {
        const url = provider.authorizationURL('state', 'v'.repeat(43));
        expect(url.searchParams.get('redirect_uri')).toBe(
          `${localOrigin}/api/auth/${provider.kind}/callback`,
        );
      }
    },
  );
  it.each([
    'http://example.com',
    'http://localhost.example.com',
    'http://192.168.1.2',
    'http://0.0.0.0',
    'http://127.1:4000',
    'http://localhost:4000/',
    'http://localhost:4000/path',
    'http://user:secret@localhost:4000',
    'http://localhost:4000?redirect=external',
  ])('does not broaden loopback opt-in to unsafe origins: %s', (unsafeOrigin) => {
    expect(() =>
      oauthProvidersFromEnvironment(github, unsafeOrigin, { allowLoopbackHttp: true }),
    ).toThrow('OAuth requires a canonical HTTPS origin or explicitly enabled loopback HTTP');
  });
  it('keeps loopback HTTP disabled when opt-in is explicitly false', () => {
    expect(() =>
      oauthProvidersFromEnvironment(github, 'http://localhost:4000', { allowLoopbackHttp: false }),
    ).toThrow('OAuth requires a canonical HTTPS origin');
  });
  it('does not require HTTPS when OAuth is disabled for local password development', () => {
    expect(oauthProvidersFromEnvironment({}, 'http://localhost:4000')).toEqual([]);
  });
  it('constructs the in-slice OAuth clients with fixed callbacks and no outbound requests', () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const providers = oauthProvidersFromEnvironment({ ...github, ...google }, origin);
    expect(providers.map((provider) => provider.kind)).toEqual(['github', 'google']);
    const verifier = 'v'.repeat(43);
    const githubURL = providers[0]!.authorizationURL('browser-state', verifier);
    expect(githubURL.origin).toBe('https://github.com');
    expect(githubURL.searchParams.get('client_id')).toBe('github-client');
    expect(githubURL.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/github/callback`);
    expect(githubURL.searchParams.get('state')).toBe('browser-state');
    expect(githubURL.href).not.toContain('github-private-secret');
    const googleURL = providers[1]!.authorizationURL('browser-state', verifier);
    expect(googleURL.origin).toBe('https://accounts.google.com');
    expect(googleURL.searchParams.get('client_id')).toBe('google-client');
    expect(googleURL.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/google/callback`);
    expect(googleURL.searchParams.get('code_challenge_method')).toBe('S256');
    expect(googleURL.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
    expect(googleURL.href).not.toContain('google-private-secret');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([github, google])('supports enabling a single provider independently', (environment) => {
    expect(oauthProvidersFromEnvironment(environment, origin)).toHaveLength(1);
  });
});
