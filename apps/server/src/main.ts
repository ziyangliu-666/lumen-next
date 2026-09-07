// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their public
// indexes.
//
// This file is the composition root, and the only place that knows all five
// slices. It builds what core provides, lets each slice register its routes and
// claim its commands, then listens.
import { headerStub } from './core/http/authGuard.js';
import { Router } from './core/http/router.js';
import { buildServer, defaultWebRoot } from './core/http/server.js';
import { Broker } from './core/protocol/broker.js';

const DEFAULT_PORT = 4000;

function bootstrap(): void {
  const log = (message: string): void => {
    console.log(message);
  };

  // Sprint 1 trusts `Authorization: stub <id>:<role>`. Identity swaps the real
  // resolver in here, and nothing else in the server changes.
  const resolver = headerStub;
  const broker = new Broker();
  const router = new Router(resolver);

  router.get('/api/health', () => ({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));

  // Each slice registers itself here once it has routes to serve or commands to
  // claim — identity, projects, session, steering, billing:
  //   registerRoutes(router);
  //   registerCommands(broker);

  const webRoot = defaultWebRoot();
  const server = buildServer({ router, broker, resolver, ...(webRoot ? { webRoot } : {}), log });

  const port = Number(process.env['LUMEN_PORT'] ?? DEFAULT_PORT);
  server.listen(port, () => {
    log(`lumen monolith up on :${port}${webRoot ? ` — web app from ${webRoot}` : ''}`);
  });

  // Drain in-flight requests before exiting, so a rolling deploy does not cut a
  // browser off mid-event.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      log(`${signal} received, closing`);
      server.close(() => process.exit(0));
    });
  }
}

bootstrap();
