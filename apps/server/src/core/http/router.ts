import type { Principal, PrincipalResolver } from './authGuard.js';
import { HttpError } from './httpError.js';

// The router every slice registers into. `node:http` and nothing else — see
// docs/ARCHITECTURE.md §6. It is deliberately transport-shaped but not
// transport-bound: dispatch() takes a plain object and returns a plain object,
// so a route can be tested without opening a socket.

export interface Request {
  readonly method: string;
  readonly path: string;
  readonly principal: Principal | null;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly cookies: Readonly<Record<string, string>>;
}

/**
 * What a handler returns becomes the JSON body; `undefined` means 204. The
 * return type is `unknown` rather than `unknown | Promise<unknown>` because the
 * union collapses — the router awaits the result either way.
 */
export type Handler = (request: Request) => unknown;

/** The raw shape the HTTP server hands in. */
export interface RawRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
}

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Route {
  readonly method: Method;
  /** Split once at registration: ['api', 'files', ':id']. */
  readonly segments: readonly string[];
  readonly handler: Handler;
}

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

/** Match one route's segments against a request's, capturing `:name` parts. */
function match(route: Route, segments: readonly string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i += 1) {
    const expected = route.segments[i];
    const actual = segments[i];
    if (expected === undefined || actual === undefined) return null;
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }
    if (expected !== actual) return null;
  }
  return params;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    if (name.length > 0) cookies[name] = pair.slice(index + 1).trim();
  }
  return cookies;
}

export class Router {
  private readonly routes: Route[] = [];

  constructor(private readonly resolver: PrincipalResolver) {}

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }
  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }
  patch(path: string, handler: Handler): this {
    return this.add('PATCH', path, handler);
  }
  delete(path: string, handler: Handler): this {
    return this.add('DELETE', path, handler);
  }

  /** True when some route owns this path, whatever the method. */
  handles(path: string): boolean {
    const segments = splitPath(path);
    return this.routes.some((route) => match(route, segments) !== null);
  }

  async dispatch(raw: RawRequest): Promise<Reply> {
    // A relative URL needs a base to parse against; the host is never read.
    const url = new URL(raw.url, 'http://lumen.invalid');
    const segments = splitPath(url.pathname);

    let pathExists = false;
    for (const route of this.routes) {
      const params = match(route, segments);
      if (params === null) continue;
      pathExists = true;
      if (route.method !== raw.method) continue;
      return this.run(route, params, raw, url);
    }

    // A path that exists under another verb is a 405, not a 404: it tells the
    // caller the URL is right and the method is not.
    return pathExists
      ? { status: 405, body: { error: 'method not allowed' } }
      : { status: 404, body: { error: 'no such route' } };
  }

  private add(method: Method, path: string, handler: Handler): this {
    this.routes.push({ method, segments: splitPath(path), handler });
    return this;
  }

  private async run(
    route: Route,
    params: Record<string, string>,
    raw: RawRequest,
    url: URL,
  ): Promise<Reply> {
    let body: unknown = null;
    if (raw.body.length > 0) {
      try {
        body = JSON.parse(raw.body);
      } catch {
        return { status: 400, body: { error: 'body is not JSON' } };
      }
    }

    const query: Record<string, string> = {};
    for (const [key, value] of url.searchParams) query[key] = value;

    // The principal is resolved before the handler runs, so a handler never
    // parses a header and never forgets to.
    const principal = await this.resolver.resolve(raw.headers['authorization']);

    const request: Request = {
      method: raw.method,
      path: url.pathname,
      principal,
      params,
      query,
      body,
      cookies: parseCookies(raw.headers['cookie']),
    };

    try {
      const result = await route.handler(request);
      return result === undefined ? { status: 204, body: null } : { status: 200, body: result };
    } catch (error) {
      if (error instanceof HttpError) {
        return { status: error.status, body: { error: error.message } };
      }
      // An unexpected throw is this server's bug. The caller gets nothing that
      // describes our internals; the log keeps the detail.
      throw error;
    }
  }
}
