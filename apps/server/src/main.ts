// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their public
// indexes.
//
// This file is the composition root, and the only place that knows all five
// slices. It builds what core provides, lets each slice register its routes and
// claim its commands, then listens.
import { headerStub } from './core/http/authGuard.js';
import { buildServer, defaultWebRoot } from './core/http/server.js';
import { Broker } from './core/protocol/broker.js';

const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  // Sprint 1 trusts `Authorization: stub <id>:<role>`. Identity swaps the real
  // resolver in here, and nothing else in the server changes.
  const resolver = headerStub;
  const broker = new Broker();

  const webRoot = defaultWebRoot();
  const app = await buildServer({ broker, resolver, ...(webRoot ? { webRoot } : {}) });

  app.get('/api/health', () => ({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));

  // Each slice registers itself here once it has routes to serve or commands to
  // claim — identity, projects, session, steering, billing:
  //   await app.register(registerRoutes);
  //   registerCommands(broker);

  const port = Number(process.env['LUMEN_PORT'] ?? DEFAULT_PORT);
  await app.listen({ port, host: '0.0.0.0' });
  if (webRoot) app.log.info(`serving the built web app from ${webRoot}`);

  // Drain in-flight work before exiting, so a rolling deploy does not cut a
  // browser off mid-event. Fastify's close() also runs the websocket plugin's
  // preClose, which is what releases the sockets still watching a session.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info(`${signal} received, closing`);
      app.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
  }
}

bootstrap().catch((error: unknown) => {
  console.error('lumen failed to start', error);
  process.exit(1);
});
