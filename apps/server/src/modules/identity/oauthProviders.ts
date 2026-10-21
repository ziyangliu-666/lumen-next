import { AuthFailure } from './authFlow.js';
import type { OAuthProfile, OAuthProvider } from './oauth.js';

export interface OAuthTokens {
  accessToken(): string;
}
/** Structural ports implemented by oauthClients.ts; the composition root supplies clients. */
export interface GitHubOAuthClient {
  createAuthorizationURL(state: string, scopes: string[]): URL;
  validateAuthorizationCode(code: string): Promise<OAuthTokens>;
}
export interface GoogleOAuthClient {
  createAuthorizationURL(state: string, verifier: string, scopes: string[]): URL;
  validateAuthorizationCode(code: string, verifier: string): Promise<OAuthTokens>;
}

type Fetch = typeof fetch;
const PROVIDER_TIMEOUT_MS = 10_000;

async function withinProviderTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('OAuth provider timed out')), PROVIDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new AuthFailure('invalid_credentials');
  return value as Record<string, unknown>;
}
/**
 * Asks the provider to show its account picker every time. Without it, a
 * person who is still signed in to the provider is signed in to lumen at once
 * by one click, with no chance to see or change the account.
 */
function withAccountPicker(url: URL): URL {
  url.searchParams.set('prompt', 'select_account');
  return url;
}
async function profileJSON(fetcher: Fetch, url: string, token: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      'user-agent': 'lumen-identity',
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) throw new AuthFailure('invalid_credentials');
  return response.json();
}

export function githubProvider(client: GitHubOAuthClient, fetcher: Fetch = fetch): OAuthProvider {
  return {
    kind: 'github',
    authorizationURL: (state) =>
      withAccountPicker(client.createAuthorizationURL(state, ['read:user', 'user:email'])),
    async profile(code): Promise<OAuthProfile> {
      try {
        const token = (
          await withinProviderTimeout(client.validateAuthorizationCode(code))
        ).accessToken();
        const user = record(await profileJSON(fetcher, 'https://api.github.com/user', token));
        const emails = await profileJSON(fetcher, 'https://api.github.com/user/emails', token);
        if (!Array.isArray(emails) || !Number.isSafeInteger(user['id']) || Number(user['id']) <= 0)
          throw new AuthFailure('invalid_credentials');
        // A public profile email is not proof of mailbox ownership.
        const primary = emails
          .map(record)
          .find((item) => item['primary'] === true && item['verified'] === true);
        if (typeof primary?.['email'] !== 'string') throw new AuthFailure('invalid_credentials');
        return {
          subject: String(user['id']),
          email: primary['email'],
          displayName:
            typeof user['name'] === 'string'
              ? user['name']
              : typeof user['login'] === 'string'
                ? user['login']
                : '',
        };
      } catch {
        // Provider tokens/responses must never escape into errors/logs.
        throw new AuthFailure('invalid_credentials');
      }
    },
  };
}

export function googleProvider(client: GoogleOAuthClient, fetcher: Fetch = fetch): OAuthProvider {
  return {
    kind: 'google',
    authorizationURL: (state, verifier) =>
      withAccountPicker(
        client.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']),
      ),
    async profile(code, verifier): Promise<OAuthProfile> {
      try {
        const token = (
          await withinProviderTimeout(client.validateAuthorizationCode(code, verifier))
        ).accessToken();
        // Use the provider's authenticated userinfo endpoint, not an unverified JWT decode.
        const user = record(
          await profileJSON(fetcher, 'https://openidconnect.googleapis.com/v1/userinfo', token),
        );
        if (
          typeof user['sub'] !== 'string' ||
          !user['sub'] ||
          typeof user['email'] !== 'string' ||
          user['email_verified'] !== true
        )
          throw new AuthFailure('invalid_credentials');
        return {
          subject: user['sub'],
          email: user['email'],
          displayName: typeof user['name'] === 'string' ? user['name'] : '',
        };
      } catch {
        throw new AuthFailure('invalid_credentials');
      }
    },
  };
}
