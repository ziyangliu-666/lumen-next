import { AsyncLocalStorage } from 'node:async_hooks';
import type { Worker } from './core/domain/worker.js';
import type { ModelProvider } from './core/model/index.js';

/**
 * The model a session chose, for every call its tasks make. The worker is
 * wrapped: before a task runs, its session's choice is looked up and held for
 * the duration of the run, and the provider below sends each call to that
 * model. A session with no choice, or one whose model is no longer offered,
 * uses the default. The same pattern as accountModel, which picks the key.
 */
export function sessionModel(
  choices: ReadonlyMap<string, ModelProvider>,
  fallback: ModelProvider,
): {
  model: ModelProvider;
  wrap: (worker: Worker, chosen: (sessionId: string) => Promise<string | undefined>) => Worker;
} {
  const current = new AsyncLocalStorage<string>();
  const pick = (): ModelProvider => choices.get(current.getStore() ?? '') ?? fallback;
  return {
    model: {
      name: 'session-selected',
      get model() {
        return pick().model;
      },
      complete: (request, signal) => pick().complete(request, signal),
    },
    wrap: (worker, chosen) => ({
      async run(task, input, report) {
        const name = (await chosen(task.sessionId)) ?? '';
        await current.run(name, () => worker.run(task, input, report));
      },
    }),
  };
}
