import type { Worker } from '../../core/domain/worker.js';

// The Sprint 1 worker: no model, no sandbox, one fixed step. It exists so the
// whole path — route, kernel, trace, broker, socket, page — runs end to end
// before the steering slice supplies the real agent loop behind the same
// interface (docs/ARCHITECTURE.md §8: "a worker that emits one fixed step and
// ends").
export const echoWorker: Worker = {
  async run(task, report) {
    await report.appendStep(task.id, `lead: received "${task.title}". No model is wired in yet.`);
  },
};
