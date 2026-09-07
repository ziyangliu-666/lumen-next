// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their barrels.
import { Broker } from './core/protocol/broker.js';
import { PointNode } from './modules/session/index.js';

function bootstrap(): void {
  const broker = new Broker();

  // Proof of wiring: one lead point, one delegated worker, cost rolled up.
  const lead = new PointNode('lead', { cents: 0 });
  lead.addChild('delegate', new PointNode('worker', { cents: 0 }));

  broker.publish({ type: 'point.opened', pointId: lead.id, parentId: null, edge: null });

  console.log(`lumen monolith up — tree size=${lead.size()}`);
}

bootstrap();
