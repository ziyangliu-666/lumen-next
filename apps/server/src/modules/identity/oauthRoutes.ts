import type { FastifyInstance } from 'fastify';
import type { Log } from '../../core/log/log.js';
import { AuthFailure } from './authFlow.js';
import { logRefusal } from './identityLog.js';
import type { LoginGate } from './loginGate.js';
import { LoginLimited } from './loginGate.js';
import { OAuthEmailConflict, type OAuthAttempts, type OAuthProvider } from './oauth.js';
import type { SessionAuthFlow } from './sessionAuthFlow.js';
import { AUTH_COOKIE } from './sessionStrategy.js';
import type { KeyRemoval } from './keyRemoval.js';
import { badRequest } from '../../core/http/httpError.js';

export interface OAuthRouteOptions {
  readonly providers: readonly OAuthProvider[];
  readonly attempts: OAuthAttempts;
  readonly removal?: { readonly service: KeyRemoval; readonly attempts: OAuthAttempts };
}
export function registerOAuthRoutes(
  app: FastifyInstance,
  options: OAuthRouteOptions | undefined,
  flow: Pick<SessionAuthFlow, 'authenticate'>,
  gate: LoginGate,
  secure: boolean,
  log: Log,
): void {
  const providers = options?.providers ?? [];
  app.get('/api/auth/providers', () => ({
    github: providers.some((provider) => provider.kind === 'github'),
    google: providers.some((provider) => provider.kind === 'google'),
  }));
  if (!options) return;
  for (const provider of providers) {
    const path = `/api/auth/${provider.kind}/callback`;
    const cookieName = `lumen_oauth_${provider.kind}`;
    const cookieOptions = { path, httpOnly: true, secure, sameSite: 'lax' as const };
    const removalCookie = `lumen_key_removal_${provider.kind}`;
    const removal = options.removal;
    if (removal) {
      // Registered inside identity's exact-Origin/no-store plugin. This action must
      // start with an explicit POST, never a normal sign-in link or callback.
      app.post(
        `/api/auth/key-removal/openai/${provider.kind}`,
        { bodyLimit: 1024 },
        async (request, reply) => {
          const body = request.body;
          if (
            typeof body !== 'object' ||
            body === null ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !('confirm' in body) ||
            body.confirm !== 'remove-openai-key'
          )
            throw badRequest('Explicit key removal confirmation required');
          try {
            const attempt = await gate.run(request.raw.socket.remoteAddress ?? 'unknown', () =>
              removal.attempts.begin(provider.kind),
            );
            const url = provider.authorizationURL(`kr_${attempt.state}`, attempt.verifier);
            if (url.protocol !== 'https:') throw new Error('OAuth authorization requires HTTPS');
            void reply.setCookie(removalCookie, attempt.binding, { ...cookieOptions, maxAge: 600 });
            return reply.redirect(url.href, 303);
          } catch (error) {
            logRefusal(log, 'key removal', error);
            if (error instanceof LoginLimited)
              return reply.code(429).send({ error: 'Too many login attempts' });
            throw error;
          }
        },
      );
    }
    app.get(`/api/auth/${provider.kind}`, async (request, reply) => {
      try {
        const attempt = await gate.run(request.raw.socket.remoteAddress ?? 'unknown', () =>
          options.attempts.begin(provider.kind),
        );
        const url = provider.authorizationURL(attempt.state, attempt.verifier);
        if (url.protocol !== 'https:') throw new Error('OAuth authorization requires HTTPS');
        void reply.setCookie(cookieName, attempt.binding, { ...cookieOptions, maxAge: 600 });
        return reply.redirect(url.href);
      } catch (error) {
        logRefusal(log, `${provider.kind} sign-in`, error);
        if (error instanceof LoginLimited)
          return reply.code(429).send({ error: 'Too many login attempts' });
        throw error;
      }
    });
    app.get<{ Querystring: { state?: unknown; code?: unknown; error?: unknown } }>(
      path,
      {
        // OAuth callbacks carry one-use code/state values in the query string.
        // Fastify's normal request-completion log includes the full URL.
        logLevel: 'silent',
      },
      async (request, reply) => {
        if (typeof request.query.state === 'string' && request.query.state.startsWith('kr_')) {
          void reply.clearCookie(removalCookie, cookieOptions);
          try {
            await gate.run(request.raw.socket.remoteAddress ?? 'unknown', async () => {
              if (!removal) throw new AuthFailure('invalid_credentials');
              const verifier = await removal.attempts.consume(
                provider.kind,
                (request.query.state as string).slice(3),
                request.cookies[removalCookie],
              );
              if (
                request.query.error !== undefined ||
                typeof request.query.code !== 'string' ||
                !request.query.code ||
                request.query.code.length > 4096
              )
                throw new AuthFailure('invalid_credentials');
              const profile = await provider.profile(request.query.code, verifier);
              await removal.service.oauth(provider.kind, profile);
            });
            // The POST explicitly initiated deletion. Fresh provider proof can
            // authorize only that deletion; no account creation or session mint.
            return reply.redirect('/?keyRemoval=complete#/signin');
          } catch (error) {
            logRefusal(log, 'key removal', error);
            if (error instanceof AuthFailure || error instanceof LoginLimited)
              return reply.redirect('/?keyRemoval=failed#/signin');
            throw error;
          }
        }
        void reply.clearCookie(cookieName, cookieOptions);
        try {
          const issued = await gate.run(request.raw.socket.remoteAddress ?? 'unknown', async () => {
            // Bound database work too, including callbacks with invalid state/binding.
            // Consume before exchange: the same callback can never be replayed.
            const verifier = await options.attempts.consume(
              provider.kind,
              request.query.state,
              request.cookies[cookieName],
            );
            if (
              request.query.error !== undefined ||
              typeof request.query.code !== 'string' ||
              !request.query.code ||
              request.query.code.length > 4096
            )
              throw new AuthFailure('invalid_credentials');
            return flow.authenticate(provider.kind, { code: request.query.code, verifier });
          });
          void reply.setCookie(AUTH_COOKIE, issued.token, {
            path: '/',
            httpOnly: true,
            secure,
            sameSite: 'lax',
            expires: new Date(issued.expiresAt),
          });
          // Fixed destinations; never reflect an external returnTo or provider text.
          return reply.redirect(issued.principal.role === 'staff' ? '/#/admin' : '/#/home');
        } catch (error) {
          logRefusal(log, `${provider.kind} sign-in`, error);
          if (error instanceof OAuthEmailConflict) {
            log.warn(
              { action: `${provider.kind} sign-in`, reason: 'email_conflict' },
              'identity refused',
            );
            return reply.redirect('/?authError=oauth_email_conflict#/signin');
          }
          if (error instanceof AuthFailure || error instanceof LoginLimited)
            return reply.redirect('/?authError=oauth_failed#/signin');
          throw error;
        }
      },
    );
  }
}
