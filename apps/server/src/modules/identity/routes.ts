import type { FastifyPluginAsync } from 'fastify';
import { requireUser } from '../../core/http/authGuard.js';
import { badRequest, forbidden, HttpError, unauthorized } from '../../core/http/httpError.js';
import { AuthFailure } from './authFlow.js';
import type { AuthSessions } from './authSessions.js';
import { LoginLimited, type LoginGate } from './loginGate.js';
import type { SessionAuthFlow } from './sessionAuthFlow.js';
import { AUTH_COOKIE } from './sessionStrategy.js';
import { AccountFailure, type AccountReader, type AccountView } from './accounts.js';
import type { AccountService } from './accountService.js';

export type { AccountReader, AccountView } from './accounts.js';

function publicAccount(account: AccountView): AccountView {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    createdAt: account.createdAt,
  };
}

async function accountAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AccountFailure) {
      throw new HttpError(error.code === 'invalid_body' ? 400 : 409, error.message);
    }
    if (error instanceof AuthFailure) throw unauthorized('Invalid credentials');
    if (error instanceof LoginLimited) throw new HttpError(429, 'Too many login attempts');
    throw error;
  }
}

export interface IdentityRouteDeps {
  readonly flow: Pick<SessionAuthFlow, 'authenticate'>;
  readonly sessions: Pick<AuthSessions, 'issue' | 'revoke' | 'revokeAll'>;
  readonly accounts: AccountReader;
  readonly management: Pick<AccountService, 'signup' | 'update' | 'changePassword'>;
  readonly origin: string;
  readonly secureCookies?: boolean;
  readonly loginGate: LoginGate;
}

/** Register as a Fastify plugin so cache/origin hooks affect identity only. */
export function identityRoutes(deps: IdentityRouteDeps): FastifyPluginAsync {
  const origin = new URL(deps.origin);
  if (origin.origin !== deps.origin || !['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('Expected a canonical HTTP(S) origin');
  }
  const secure = deps.secureCookies ?? true;
  if (
    !secure &&
    !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
  ) {
    throw new Error('Insecure cookies require a loopback HTTP origin');
  }
  if (secure && origin.protocol !== 'https:') throw new Error('Secure cookies require HTTPS');
  const cookieOptions = { path: '/', httpOnly: true, secure, sameSite: 'lax' as const };

  return (app): Promise<void> => {
    // Also covers failures from core's earlier principal-resolution hook.
    app.addHook('onSend', (_request, reply, payload, done) => {
      void reply.header('Cache-Control', 'no-store');
      done(null, payload);
    });
    app.addHook('onRequest', (request, reply, done) => {
      void reply.header('Cache-Control', 'no-store');
      if (
        request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        request.headers.origin !== deps.origin
      ) {
        done(forbidden('Untrusted request origin'));
        return;
      }
      done();
    });

    app.post<{ Body: { email: string; password: string } }>(
      '/api/auth/password',
      {
        bodyLimit: 8192,
        preValidation: (request, _reply, done) => {
          // Fastify's default schema coercion must not turn numeric secrets
          // into passwords or numeric values into email lookup keys.
          const body: unknown = request.body;
          if (
            typeof body !== 'object' ||
            body === null ||
            Array.isArray(body) ||
            !('email' in body) ||
            typeof body.email !== 'string' ||
            !('password' in body) ||
            typeof body.password !== 'string'
          ) {
            done(badRequest('Invalid request body'));
            return;
          }
          done();
        },
        schema: {
          body: {
            type: 'object',
            required: ['email', 'password'],
            additionalProperties: false,
            properties: {
              email: { type: 'string', minLength: 1, maxLength: 320 },
              password: { type: 'string', minLength: 1, maxLength: 1024 },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          // Core trusts proxy headers today. Do not let an arbitrary forwarded
          // address choose a fresh rate-limit key. Behind a proxy this groups
          // clients conservatively until the deployment trust policy is reviewed.
          const issued = await deps.loginGate.run(
            request.raw.socket.remoteAddress ?? 'unknown',
            () => deps.flow.authenticate('password', request.body),
          );
          void reply.setCookie(AUTH_COOKIE, issued.token, {
            ...cookieOptions,
            expires: new Date(issued.expiresAt),
          });
          return { accountId: issued.principal.accountId, role: issued.principal.role };
        } catch (error) {
          if (error instanceof AuthFailure) throw unauthorized('Invalid credentials');
          if (error instanceof LoginLimited) throw new HttpError(429, 'Too many login attempts');
          throw error;
        }
      },
    );

    app.post('/api/auth/signup', { bodyLimit: 8192 }, async (request, reply) => {
      const issued = await accountAction(() =>
        deps.loginGate.run(request.raw.socket.remoteAddress ?? 'unknown', async () => {
          const account = await deps.management.signup(request.body);
          return deps.sessions.issue({ accountId: account.id, role: account.role });
        }),
      );
      void reply.setCookie(AUTH_COOKIE, issued.token, {
        ...cookieOptions,
        expires: new Date(issued.expiresAt),
      });
      return reply
        .code(201)
        .send({ accountId: issued.principal.accountId, role: issued.principal.role });
    });

    app.patch('/api/me', { bodyLimit: 8192 }, async (request) => {
      const principal = requireUser(request);
      const account = await accountAction(() =>
        deps.loginGate.run(request.raw.socket.remoteAddress ?? 'unknown', () =>
          deps.management.update(principal.accountId, request.body),
        ),
      );
      return publicAccount(account);
    });

    app.post('/api/me/password', { bodyLimit: 8192 }, async (request, reply) => {
      const principal = requireUser(request);
      await accountAction(() =>
        deps.loginGate.run(request.raw.socket.remoteAddress ?? 'unknown', () =>
          deps.management.changePassword(principal.accountId, request.body),
        ),
      );
      return reply.code(204).send();
    });

    app.post('/api/auth/signout', async (request, reply) => {
      // Idempotent even for an absent/expired cookie; storage errors still fail.
      await deps.sessions.revoke(request.cookies[AUTH_COOKIE]);
      void reply.clearCookie(AUTH_COOKIE, cookieOptions);
      return reply.code(204).send();
    });

    app.post('/api/auth/signout-all', async (request, reply) => {
      const principal = requireUser(request);
      await deps.sessions.revokeAll(principal.accountId);
      void reply.clearCookie(AUTH_COOKIE, cookieOptions);
      return reply.code(204).send();
    });

    app.get('/api/me', async (request) => {
      const principal = requireUser(request);
      const account = await deps.accounts.getAccount(principal.accountId);
      if (!account) throw unauthorized();
      // Explicit projection avoids leaking a password hash if an adapter
      // happens to return extra fields beyond the declared AccountView.
      return publicAccount(account);
    });
    return Promise.resolve();
  };
}
