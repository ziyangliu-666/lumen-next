import { pino, type Logger } from 'pino';

// The one logger. Fastify writes its request lines through it and every slice
// writes through a child of it, so one run reads as one stream: same format,
// same level, same redaction. A slice never calls console.
//
// Correlation: the kernel gives each task run a child with sessionId, taskId
// and accountId (taskLog), and hands it to the worker on its WorkerReport. A
// worker logs what it did; it never adds those fields itself.

export type Log = Logger;

export interface LogOptions {
  /** pino level name: trace, debug, info, warn, error, fatal, silent. */
  readonly level?: string;
  /** Human-readable lines for a terminal. Needs pino-pretty, a dev dependency. */
  readonly pretty?: boolean;
  /** Where the lines go. Stdout when not given; a test hands in its own sink. */
  readonly stream?: NodeJS.WritableStream;
}

/**
 * Keys whose values are never written, at the top of a line or one level
 * down. Request and response headers that carry a credential, and the names
 * a key, a password or a token travels under.
 */
export const REDACTED_KEYS = ['apiKey', 'authorization', 'cookie', 'password', 'secret', 'token'];

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...REDACTED_KEYS.flatMap((key) => [key, `*.${key}`]),
];

export function createLog(options: LogOptions = {}): Log {
  const settings = {
    level: options.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(options.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
  return options.stream ? pino(settings, options.stream) : pino(settings);
}

/** Writes nothing. For a test, and for a caller that was given no logger. */
export const nullLog: Log = pino({ level: 'silent' });

/** The child every line of one task run is written through. */
export function taskLog(
  log: Log,
  ids: { readonly sessionId: string; readonly taskId: string; readonly accountId?: string },
): Log {
  return log.child(ids);
}
