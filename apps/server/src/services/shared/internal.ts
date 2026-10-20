// Calls between services inside the cluster. Every /internal/* route carries a
// shared secret in one header, and the Ingress never routes /internal/*, so a
// browser cannot reach them even if it guesses a path (docs/platform/contract.md,
// "Internal calls").
import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../../core/http/httpError.js';

export const INTERNAL_HEADER = 'x-lumen-internal';

/** The default for every internal call except delegate, which waits for children. */
export const INTERNAL_TIMEOUT_MS = 10_000;

/**
 * A preHandler for internal routes. It answers 401 unless the header holds the
 * shared key. The comparison is constant-time, so the key cannot be guessed a
 * byte at a time from response times.
 */
export function requireInternalKey(key: string) {
  const expected = Buffer.from(key);
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const given = request.headers[INTERNAL_HEADER];
    const actual = Buffer.from(typeof given === 'string' ? given : '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      await reply.status(401).send({ error: 'internal key required' });
    }
  };
}

/** One call to another service. Resolves with the parsed body, or undefined for 204. */
export type InternalCall = <T = unknown>(
  path: string,
  body?: unknown,
  options?: { readonly timeoutMs?: number },
) => Promise<T>;

/**
 * A caller for one service's base URL. A non-2xx answer becomes an HttpError
 * with the same status and message, so a 4xx from session reaches the browser
 * as the same 4xx, and a 5xx or a timeout reads as "the service is down".
 */
export function internalCaller(
  baseUrl: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): InternalCall {
  const base = baseUrl.replace(/\/$/, '');
  return async <T>(
    path: string,
    body?: unknown,
    options?: { readonly timeoutMs?: number },
  ): Promise<T> => {
    const response = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADER]: key },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(options?.timeoutMs ?? INTERNAL_TIMEOUT_MS),
    });
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const parsed: unknown = text === '' ? undefined : JSON.parse(text);
    if (!response.ok) {
      const message =
        typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `internal call ${path} failed`;
      throw new InternalCallError(response.status, message, parsed);
    }
    return parsed as T;
  };
}

/** An internal call answered with an error status. `body` is the parsed answer. */
export class InternalCallError extends HttpError {
  constructor(
    status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(status, message);
    this.name = 'InternalCallError';
  }
}
