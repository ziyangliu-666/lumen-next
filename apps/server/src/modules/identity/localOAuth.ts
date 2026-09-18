import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OAuthProvider } from './oauth.js';
import {
  githubProvider,
  googleProvider,
  type GitHubOAuthClient,
  type GoogleOAuthClient,
} from './oauthProviders.js';

/** Development composition only. Production must inject reviewed library adapters. */
export async function localOAuthProviders(toolDirectory: string): Promise<OAuthProvider[]> {
  const githubId = process.env['GITHUB_OAUTH_CLIENT_ID'];
  const githubSecret = process.env['GITHUB_OAUTH_CLIENT_SECRET'];
  const googleId = process.env['GOOGLE_OAUTH_CLIENT_ID'];
  const googleSecret = process.env['GOOGLE_OAUTH_CLIENT_SECRET'];
  if (Boolean(githubId) !== Boolean(githubSecret) || Boolean(googleId) !== Boolean(googleSecret)) {
    throw new Error('Each OAuth provider requires both client ID and client secret');
  }
  if (!githubId && !googleId) return [];
  const modulePath =
    process.env['IDENTITY_ARCTIC_MODULE'] ??
    resolve(toolDirectory, 'node_modules/arctic/dist/index.js');
  const library = (await import(pathToFileURL(modulePath).href)) as {
    GitHub: new (id: string, secret: string, callback: string) => GitHubOAuthClient;
    Google: new (id: string, secret: string, callback: string) => GoogleOAuthClient;
  };
  const providers: OAuthProvider[] = [];
  if (githubId && githubSecret)
    providers.push(
      githubProvider(
        new library.GitHub(
          githubId,
          githubSecret,
          'http://localhost:4000/api/auth/github/callback',
        ),
      ),
    );
  if (googleId && googleSecret)
    providers.push(
      googleProvider(
        new library.Google(
          googleId,
          googleSecret,
          'http://localhost:4000/api/auth/google/callback',
        ),
      ),
    );
  return providers;
}
