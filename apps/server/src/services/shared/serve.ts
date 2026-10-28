// Listening and shutting down, the same way for every service. Kubernetes sends
// SIGTERM before it removes a pod; each service closes what it holds, in the
// order given, and exits. A rolling update then never cuts a request in half.
import type { FastifyInstance } from 'fastify';
import type { Log } from '../../core/log/log.js';
import { port } from './env.js';

export type Closer = () => Promise<void> | void;

export async function serve(
  server: FastifyInstance,
  log: Log,
  closers: readonly Closer[] = [],
): Promise<void> {
  await server.listen({ port: port(), host: '0.0.0.0' });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      log.info(`${signal} received, closing`);
      const steps: Closer[] = [() => server.close(), ...closers];
      steps
        .reduce<Promise<void>>((previous, close) => previous.then(() => close()), Promise.resolve())
        .then(
          () => process.exit(0),
          (error: unknown) => {
            log.error({ err: error }, 'shutdown failed');
            process.exit(1);
          },
        );
    });
  }
}

/** The top of every service file: start, or log why not and exit non-zero. */
export function run(log: Log, start: () => Promise<void>): void {
  start().catch((error: unknown) => {
    log.fatal({ err: error }, 'service failed to start');
    process.exit(1);
  });
}
