import { createHash } from 'node:crypto';
import type { GitHubOAuthClient, GoogleOAuthClient, OAuthTokens } from './oauthProviders.js';

/**
 * Minimal OAuth 2.0 authorization-code clients for GitHub and Google. They send
 * the same requests Arctic 3.7.0 sent and implement the structural ports in
 * oauthProviders.ts. Thrown errors carry a fixed message only: never the client
 * secret, the code, a token or the provider's error body.
 */
type Fetch = typeof fetch;

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const TOKEN_TIMEOUT_MS = 10_000;
// RFC 7636 section 4.1: 43 to 128 unreserved characters.
const PKCE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

function exchangeFailed(): Error {
  return new Error('OAuth token exchange failed');
}

function requireVerifier(verifier: string): void {
  if (!PKCE_VERIFIER.test(verifier)) throw new Error('OAuth PKCE verifier is invalid');
}

class AccessToken implements OAuthTokens {
  readonly #value: string;
  constructor(value: string) {
    this.#value = value;
  }
  accessToken(): string {
    return this.#value;
  }
}

/** Shared by both providers: the authorization-code grant with HTTP Basic client authentication. */
class AuthorizationCodeClient {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #redirectURI: string;
  readonly #fetcher: Fetch | undefined;

  constructor(clientId: string, clientSecret: string, redirectURI: string, fetcher?: Fetch) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#redirectURI = redirectURI;
    this.#fetcher = fetcher;
  }

  /** A verifier adds an S256 PKCE challenge; the verifier itself never leaves the server here. */
  authorizationURL(endpoint: string, state: string, scopes: string[], verifier?: string): URL {
    const url = new URL(endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.#clientId);
    url.searchParams.set('redirect_uri', this.#redirectURI);
    url.searchParams.set('state', state);
    if (verifier !== undefined) {
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
    }
    if (scopes.length > 0) url.searchParams.set('scope', scopes.join(' '));
    return url;
  }

  async exchange(
    endpoint: string,
    code: string,
    extra: Record<string, string> = {},
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.#redirectURI,
      ...extra,
    });
    const credentials = Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString('base64');
    // Resolve the global at call time so a stubbed fetch is honoured.
    const fetcher = this.#fetcher ?? fetch;
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          // GitHub rejects API requests without a User-Agent.
          'user-agent': 'lumen-identity',
          authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
        redirect: 'error',
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
    } catch {
      throw exchangeFailed();
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      throw exchangeFailed();
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw exchangeFailed();
    }
    // GitHub reports a failed exchange as 200 with an `error` field.
    if (typeof data !== 'object' || data === null || Array.isArray(data) || 'error' in data)
      throw exchangeFailed();
    const token = (data as Record<string, unknown>)['access_token'];
    if (typeof token !== 'string' || token === '') throw exchangeFailed();
    return new AccessToken(token);
  }
}

/** GitHub OAuth apps: no PKCE, client authenticated with HTTP Basic, as Arctic did. */
export class GitHubClient implements GitHubOAuthClient {
  readonly #client: AuthorizationCodeClient;
  constructor(clientId: string, clientSecret: string, redirectURI: string, fetcher?: Fetch) {
    this.#client = new AuthorizationCodeClient(clientId, clientSecret, redirectURI, fetcher);
  }
  createAuthorizationURL(state: string, scopes: string[]): URL {
    return this.#client.authorizationURL(GITHUB_AUTHORIZE, state, scopes);
  }
  validateAuthorizationCode(code: string): Promise<OAuthTokens> {
    return this.#client.exchange(GITHUB_TOKEN, code);
  }
}

/** Google web clients: S256 PKCE plus a client secret sent with HTTP Basic. */
export class GoogleClient implements GoogleOAuthClient {
  readonly #client: AuthorizationCodeClient;
  constructor(clientId: string, clientSecret: string, redirectURI: string, fetcher?: Fetch) {
    this.#client = new AuthorizationCodeClient(clientId, clientSecret, redirectURI, fetcher);
  }
  createAuthorizationURL(state: string, verifier: string, scopes: string[]): URL {
    requireVerifier(verifier);
    return this.#client.authorizationURL(GOOGLE_AUTHORIZE, state, scopes, verifier);
  }
  async validateAuthorizationCode(code: string, verifier: string): Promise<OAuthTokens> {
    requireVerifier(verifier);
    return this.#client.exchange(GOOGLE_TOKEN, code, { code_verifier: verifier });
  }
}
