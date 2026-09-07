import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Broker } from '../protocol/broker.js';
import type { PrincipalResolver } from './authGuard.js';
import type { Reply, Router, SetCookie } from './router.js';
import { attachEventStream } from './wsBridge.js';

// node:http and nothing else (docs/ARCHITECTURE.md §6). Three things share one
// port, in this order: the API under /api, the event stream at /ws, and — in
// production — the built SPA on everything else. One origin, so no CORS.

/** A frame of request body larger than this is refused before it is buffered. */
const MAX_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface ServerDeps {
  readonly router: Router;
  readonly broker: Broker;
  readonly resolver: PrincipalResolver;
  /** Where the built SPA lives. Absent in development: Vite serves it instead. */
  readonly webRoot?: string;
  readonly log?: (message: string) => void;
}

/** What buildServer hands back: the listener, and the one way to stop it. */
export interface HttpServer {
  readonly server: Server;
  /** Stop listening, close the event stream, drain, and resolve when gone. */
  close(graceMs?: number): Promise<void>;
}

/** How long a shutdown waits for in-flight work before cutting the rest off. */
const DEFAULT_GRACE_MS = 10_000;

export function buildServer(deps: ServerDeps): HttpServer {
  const log = deps.log ?? ((): void => {});
  const webRoot = deps.webRoot !== undefined ? resolve(deps.webRoot) : null;

  const server = createServer((request, response) => {
    handle(request, response, deps, webRoot).catch((error: unknown) => {
      // A throw that got this far is this server's bug. The client learns
      // nothing about our internals; the log keeps the detail.
      log(`http: unhandled error: ${String(error)}`);
      if (!response.headersSent) sendJson(response, 500, { error: 'internal error' });
    });
  });

  const closeStream = attachEventStream(server, {
    broker: deps.broker,
    resolver: deps.resolver,
    log,
  });

  return {
    server,
    close: (graceMs = DEFAULT_GRACE_MS) => closeGracefully(server, closeStream, log, graceMs),
  };
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ServerDeps,
  webRoot: string | null,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://lumen.invalid');

  if (url.pathname.startsWith('/api/')) {
    const body = await readBody(request);
    if (body === null) {
      sendJson(response, 413, { error: 'body too large' });
      return;
    }
    const reply = await deps.router.dispatch({
      method: request.method ?? 'GET',
      url: request.url ?? '/',
      headers: request.headers as Record<string, string | undefined>,
      body,
    });
    sendReply(response, reply);
    return;
  }

  if (webRoot) {
    sendStatic(response, webRoot, url.pathname);
    return;
  }
  sendJson(response, 404, { error: 'no such route' });
}

/** Collect the body, or null when it exceeds the cap. */
function readBody(request: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Stop reading; the caller answers 413.
        request.destroy();
        resolveBody(null);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

/**
 * Secure by default: HttpOnly unless a cookie is explicitly for the browser's
 * own scripts, and SameSite=Lax, which still survives the redirect back from an
 * OAuth provider.
 */
function serializeCookie(cookie: SetCookie): string {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  parts.push(`Path=${cookie.path ?? '/'}`);
  if (cookie.maxAgeSeconds !== undefined) parts.push(`Max-Age=${cookie.maxAgeSeconds}`);
  if (cookie.httpOnly !== false) parts.push('HttpOnly');
  if (cookie.secure) parts.push('Secure');
  parts.push(`SameSite=${cookie.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

function sendReply(response: ServerResponse, reply: Reply): void {
  const headers: Record<string, string | string[] | number> = { ...reply.headers };
  if (reply.cookies.length > 0) {
    headers['set-cookie'] = reply.cookies.map(serializeCookie);
  }

  // 204 carries no body, and a redirect's body is never read. Writing one would
  // make some proxies and every spec-following client unhappy.
  const bodyless = reply.status === 204 || (reply.status >= 300 && reply.status < 400);
  if (bodyless) {
    response.writeHead(reply.status, headers).end();
    return;
  }

  const payload = JSON.stringify(reply.body);
  headers['content-type'] = 'application/json; charset=utf-8';
  headers['content-length'] = Buffer.byteLength(payload);
  response.writeHead(reply.status, headers);
  response.end(payload);
}

function sendStatic(response: ServerResponse, root: string, pathname: string): void {
  // The pages use a hash router, so every route lives after the '#' and never
  // reaches here. '/' is the only path that maps to index.html; a switch to
  // path-based routing would need a fallback for unknown paths as well.
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);

  // Resolve, then prove the result is still inside the root. Checking the input
  // for '..' is not enough — encodings and separators vary.
  const target = resolve(root, normalize(requested));
  if (target !== root && !target.startsWith(root + sep)) {
    sendJson(response, 403, { error: 'not yours' });
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    sendJson(response, 404, { error: 'no such file' });
    return;
  }

  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
  });
  createReadStream(target).pipe(response);
}

/**
 * Stop listening, let in-flight work finish, and be gone.
 *
 * The one that actually hangs a shutdown here is the event stream. `close()`
 * waits for every open connection, and a WebSocket is never idle, so a single
 * browser tab watching a session would hold the process open until its
 * orchestrator lost patience and SIGKILLed it — the abrupt cut that draining
 * was supposed to avoid. So the stream is closed first, plain idle sockets are
 * released next, and whatever is still in flight gets `graceMs` and is then cut.
 */
function closeGracefully(
  server: Server,
  closeStream: () => void,
  log: (message: string) => void,
  graceMs: number,
): Promise<void> {
  return new Promise((done) => {
    const forceful = setTimeout(() => {
      log('shutdown: forcing the remaining connections closed');
      server.closeAllConnections();
    }, graceMs);

    closeStream();
    server.close(() => {
      clearTimeout(forceful);
      done();
    });
    server.closeIdleConnections();
  });
}

/** Where the built SPA lands, relative to the process's working directory. */
export function defaultWebRoot(): string | undefined {
  const candidate = join(process.cwd(), 'apps', 'web', 'dist');
  return existsSync(candidate) ? candidate : undefined;
}
