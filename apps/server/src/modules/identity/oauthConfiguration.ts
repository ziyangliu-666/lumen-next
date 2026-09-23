import type { OAuthProvider } from './oauth.js';
import { GitHubClient, GoogleClient } from './oauthClients.js';
import { githubProvider, googleProvider } from './oauthProviders.js';

type Environment = Readonly<Record<string, string | undefined>>;
export interface OAuthConfigurationOptions {
  /** Explicit local acceptance only. Production callers must leave this disabled. */
  readonly allowLoopbackHttp?: boolean;
}
interface Credentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

function credentials(environment: Environment, kind: 'GitHub' | 'Google'): Credentials | null {
  const prefix = kind.toUpperCase();
  const clientId = environment[`${prefix}_OAUTH_CLIENT_ID`];
  const clientSecret = environment[`${prefix}_OAUTH_CLIENT_SECRET`];
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret) {
    throw new Error(`${kind} OAuth requires both client ID and client secret`);
  }
  if (
    [clientId, clientSecret].some(
      (value) =>
        value.trim() !== value ||
        [...value].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
    )
  ) {
    throw new Error(`Invalid ${kind} OAuth credentials`);
  }
  return { clientId, clientSecret };
}

/**
 * The process explicitly supplies its environment; the slice never reads ambient
 * secrets. This constructs adapters only and performs no provider network calls.
 * Empty pairs disable providers; partial pairs fail startup rather than silently
 * advertising an authentication method that cannot finish.
 */
export function oauthProvidersFromEnvironment(
  environment: Environment,
  origin: string,
  options: OAuthConfigurationOptions = {},
): readonly OAuthProvider[] {
  const github = credentials(environment, 'GitHub');
  const google = credentials(environment, 'Google');
  if (!github && !google) return [];
  // Do not propagate URL parser errors: they may include credentials or query data.
  try {
    const parsed = new URL(origin);
    const localHttp =
      options.allowLoopbackHttp === true &&
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.origin !== origin || (parsed.protocol !== 'https:' && !localHttp)) throw new Error();
  } catch {
    throw new Error(
      options.allowLoopbackHttp === true
        ? 'OAuth requires a canonical HTTPS origin or explicitly enabled loopback HTTP'
        : 'OAuth requires a canonical HTTPS origin',
    );
  }
  const providers: OAuthProvider[] = [];
  if (github) {
    providers.push(
      githubProvider(
        new GitHubClient(
          github.clientId,
          github.clientSecret,
          `${origin}/api/auth/github/callback`,
        ),
      ),
    );
  }
  if (google) {
    providers.push(
      googleProvider(
        new GoogleClient(
          google.clientId,
          google.clientSecret,
          `${origin}/api/auth/google/callback`,
        ),
      ),
    );
  }
  return providers;
}
