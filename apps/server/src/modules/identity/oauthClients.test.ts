import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GitHubClient, GoogleClient } from './oauthClients.js';

const secret = 'private-client-secret';
const verifier = 'v'.repeat(43);
const githubCallback = 'https://lumen.example/api/auth/github/callback';
const googleCallback = 'https://lumen.example/api/auth/google/callback';

function reply(body: string, status = 200): typeof fetch {
  return vi.fn<typeof fetch>(() => Promise.resolve(new Response(body, { status })));
}
function json(value: unknown, status = 200): typeof fetch {
  return reply(JSON.stringify(value), status);
}
interface Sent {
  readonly url: string;
  readonly init: RequestInit;
  readonly raw: string;
  readonly body: URLSearchParams;
}
function sent(fetcher: typeof fetch): Sent {
  const [url, init] = vi.mocked(fetcher).mock.calls[0]!;
  // The clients always pass a string URL and a string body.
  const raw = init!.body as string;
  return { url: url as string, init: init!, raw, body: new URLSearchParams(raw) };
}
function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}
function basic(id: string, password: string): string {
  return `Basic ${Buffer.from(`${id}:${password}`).toString('base64')}`;
}
async function failure(operation: Promise<unknown>): Promise<Error> {
  const error = await operation.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  const text = `${String(error)} ${JSON.stringify(error)} ${String((error as Error).cause)}`;
  for (const leak of [secret, 'provider-detail', 'bad_verification_code', 'leaked-token'])
    expect(text).not.toContain(leak);
  return error as Error;
}

describe('identity: GitHub OAuth client', () => {
  const client = (fetcher: typeof fetch = json({}), redirect = githubCallback): GitHubClient =>
    new GitHubClient('github-client', secret, redirect, fetcher);

  it('builds the authorization URL Arctic 3.7.0 built, without the secret', () => {
    const url = client().createAuthorizationURL('browser-state', ['read:user', 'user:email']);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'github-client',
      state: 'browser-state',
      scope: 'read:user user:email',
      redirect_uri: githubCallback,
    });
    expect(url.href).not.toContain(secret);
  });

  it('omits an empty scope list, as Arctic did', () => {
    expect(client().createAuthorizationURL('s', []).searchParams.has('scope')).toBe(false);
  });

  it('exchanges the code with Basic credentials and a form-encoded grant', async () => {
    const fetcher = json({ access_token: 'gho_token', token_type: 'bearer' });
    const tokens = await client(fetcher).validateAuthorizationCode('the-code');
    expect(tokens.accessToken()).toBe('gho_token');
    const { url, init, raw, body } = sent(fetcher);
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(header(init, 'content-type')).toBe('application/x-www-form-urlencoded');
    expect(header(init, 'accept')).toBe('application/json');
    expect(header(init, 'user-agent')).toBeTruthy();
    expect(header(init, 'authorization')).toBe(basic('github-client', secret));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: githubCallback,
    });
    expect(raw).not.toContain(secret);
  });

  it('treats GitHub’s 200 response carrying an OAuth error as a failure', async () => {
    const fetcher = json({
      error: 'bad_verification_code',
      error_description: 'provider-detail',
    });
    await failure(client(fetcher).validateAuthorizationCode('code'));
  });

  it.each([
    ['a non-2xx status', reply('{"access_token":"leaked-token"}', 502)],
    ['a 400 with an OAuth error', json({ error: 'bad_verification_code' }, 400)],
    ['a non-JSON body', reply('<html>provider-detail</html>')],
    ['a JSON array', json(['leaked-token'])],
    ['a JSON null', json(null)],
    ['a missing access_token', json({ token_type: 'bearer' })],
    ['a non-string access_token', json({ access_token: 42 })],
    ['an empty access_token', json({ access_token: '' })],
  ])('fails without detail on %s', async (_case, fetcher) => {
    await failure(client(fetcher).validateAuthorizationCode('code'));
  });

  it('fails without detail when the transport rejects', async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error(`provider-detail ${secret}`)),
    );
    await failure(client(fetcher).validateAuthorizationCode('code'));
  });

  it('uses the global fetch at call time when none is injected', async () => {
    const fetcher = json({ access_token: 'gho_token' });
    vi.stubGlobal('fetch', fetcher);
    try {
      const github = new GitHubClient('github-client', secret, githubCallback);
      await github.validateAuthorizationCode('code');
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not expose the client secret through enumeration or JSON', () => {
    const github = client();
    expect(JSON.stringify(github)).not.toContain(secret);
    expect(Object.values(github).join(' ')).not.toContain(secret);
  });
});

describe('identity: Google OAuth client', () => {
  const client = (fetcher: typeof fetch = json({})): GoogleClient =>
    new GoogleClient('google-client', secret, googleCallback, fetcher);

  it('builds the authorization URL with an S256 challenge of the verifier', () => {
    const url = client().createAuthorizationURL('browser-state', verifier, [
      'openid',
      'email',
      'profile',
    ]);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'google-client',
      redirect_uri: googleCallback,
      state: 'browser-state',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      scope: 'openid email profile',
    });
    expect(url.href).not.toContain(secret);
    expect(url.href).not.toContain(verifier);
  });

  it('exchanges the code with the verifier and Basic credentials', async () => {
    const fetcher = json({ access_token: 'ya29.token', token_type: 'Bearer', expires_in: 3599 });
    const tokens = await client(fetcher).validateAuthorizationCode('the-code', verifier);
    expect(tokens.accessToken()).toBe('ya29.token');
    const { url, init, body } = sent(fetcher);
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(header(init, 'content-type')).toBe('application/x-www-form-urlencoded');
    expect(header(init, 'accept')).toBe('application/json');
    expect(header(init, 'authorization')).toBe(basic('google-client', secret));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: googleCallback,
      code_verifier: verifier,
    });
  });

  it.each([
    ['an OAuth error body', json({ error: 'invalid_grant', error_description: 'provider-detail' })],
    ['a 400 with an OAuth error', json({ error: 'invalid_grant' }, 400)],
    ['a non-2xx status', reply('provider-detail', 500)],
    ['a non-JSON body', reply('provider-detail')],
    ['a missing access_token', json({ id_token: 'leaked-token' })],
  ])('fails without detail on %s', async (_case, fetcher) => {
    await failure(client(fetcher).validateAuthorizationCode('code', verifier));
  });

  it.each(['', 'short', 'v'.repeat(129), `${'v'.repeat(42)} `, `${'v'.repeat(42)}+`])(
    'requires an RFC 7636 verifier before building a URL or calling the provider: %j',
    async (bad) => {
      const fetcher = json({ access_token: 'ya29.token' });
      expect(() => client(fetcher).createAuthorizationURL('s', bad, ['openid'])).toThrow(
        'OAuth PKCE verifier is invalid',
      );
      await expect(client(fetcher).validateAuthorizationCode('code', bad)).rejects.toThrow(
        'OAuth PKCE verifier is invalid',
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
