// The monolith. One process, one database, no service mesh, no public API
// between the slices — they call each other in-process through their public
// indexes.
import { makeTask } from './core/domain/task.js';
import { Broker } from './core/protocol/broker.js';
import { TaskNode } from './modules/session/index.js';

function bootstrap(): void {
  const broker = new Broker();

  // Proof of wiring: one lead task, one delegated worker, cost rolled up.
  const lead = new TaskNode('lead', { dollars: 0 });
  lead.addChild(new TaskNode('worker', { dollars: 0 }));

  broker.publish({ type: 'task.opened', task: makeTask('lead', 's1', null, 'lead', '', 0) });

  console.log(`lumen monolith up — tree size=${lead.size()}`);
}

bootstrap();
