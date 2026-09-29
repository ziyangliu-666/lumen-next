import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { createLog, type Log } from '../log/log.js';
import type { Broker } from '../protocol/broker.js';
import type { Principal, PrincipalResolver, SessionAccess } from './authGuard.js';
import { HttpError } from './httpError.js';
import { registerEventStream } from './wsBridge.js';

// The one HTTP server for the whole monolith. Three things share one port, in
// this order: the API under /api, the event stream at /ws, and — in production —
// the built SPA on everything else. One origin, so there is no CORS anywhere.

// Every request carries a principal, resolved once before any handler runs, so
// that a handler never parses a header and never forgets to.
declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | null;
  }
}

/** Read a thrown value's status without trusting its declared type. */
function statusOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const raw: unknown = (error as { statusCode?: unknown }).statusCode;
    if (typeof raw === 'number') return raw;
  }
  return 500;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'bad request';
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export interface ServerDeps {
  readonly broker: Broker;
  readonly resolver: PrincipalResolver;
  /**
   * Required, not optional, and that is the point: the server cannot be built
   * without an answer to "who may watch this session?", so no future entry
   * point can quietly skip the question.
   */
  readonly access: SessionAccess;
  /** Where the built SPA lives. Absent in development: Vite serves it instead. */
  readonly webRoot?: string;
  /** The process's logger. Request lines and every slice's lines go through it. */
  readonly log?: Log;
  /** Level for the logger built here when none is given. */
  readonly logLevel?: string;
  /** Send Strict-Transport-Security. Only behind HTTPS: a browser remembers it for a year. */
  readonly strictTransport?: boolean;
}

/** What each slice's public index exports, per docs/ARCHITECTURE.md §6. */
export type RegisterRoutes = (app: FastifyInstance) => void | Promise<void>;

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  // Typed as Fastify's own logger interface, so the instance type stays the
  // default one every route file already names.
  const logger: FastifyBaseLogger =
    deps.log ?? createLog({ level: deps.logLevel ?? process.env['LUMEN_LOG_LEVEL'] ?? 'info' });
  const app = Fastify({
    loggerInstance: logger,
    // Behind a load balancer this is what makes request.ip the real client.
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(websocket);

  // The response headers a scanner asks for, set here so that no route can
  // forget them. The policy allows the app's own files, the two Google Fonts
  // hosts index.html links, inline style attributes (Radix positions its
  // popovers with them) and the event stream over the same host.
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (deps.strictTransport) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  app.decorateRequest('principal', null);
  // onRequest, not preHandler: the event stream has to know who is connecting
  // before the socket is upgraded, and that is earlier than a body is parsed.
  app.addHook('onRequest', async (request) => {
    request.principal = await deps.resolver.resolve({
      authorization: request.headers.authorization,
      cookies: request.cookies,
    });
  });

  // The one way a handler says "not 200"; anything else that escapes is a bug,
  // and the caller learns nothing about our internals.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      void reply.status(error.status).send({ error: error.message });
      return;
    }
    // Fastify and its plugins raise their own errors with a status already on
    // them — a body that is not JSON is a 400, one over the limit a 413. Those
    // are the caller's fault, and answering 500 would be a lie that sends
    // somebody looking for a server bug that is not there.
    const status = statusOf(error);
    if (status < 500) {
      void reply.status(status).send({ error: messageOf(error) });
      return;
    }
    request.log.error({ err: error }, 'unhandled error');
    void reply.status(500).send({ error: 'internal error' });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: 'no such route' });
  });

  registerEventStream(app, deps.broker, deps.access);

  if (deps.webRoot !== undefined) {
    // The pages use a hash router, so every route lives after the '#' and never
    // reaches the server; index.html at '/' is all that is needed. A move to
    // path-based routing would want a history fallback here as well.
    await app.register(staticFiles, { root: resolve(deps.webRoot) });
  }

  return app;
}

/** Where the built SPA lands, relative to the process's working directory. */
export function defaultWebRoot(): string | undefined {
  const candidate = join(process.cwd(), 'apps', 'web', 'dist');
  return existsSync(candidate) ? candidate : undefined;
}
