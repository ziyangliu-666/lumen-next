import { Writable } from 'node:stream';
import { createLog, type Log } from './log.js';

/** A logger that keeps its lines in memory, for a test to read back. */
export function capture(level = 'info'): { log: Log; lines: () => Record<string, unknown>[] } {
  const raw: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, next) {
      raw.push(chunk.toString());
      next();
    },
  });
  return {
    log: createLog({ level, stream }),
    lines: () =>
      raw
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}
