import { AsyncLocalStorage } from 'node:async_hooks';
import type { Worker } from './core/domain/worker.js';
import { ModelError, type ModelProvider } from './core/model/index.js';

/** Composition-owned context: owner IDs come from session storage, never model input. */
export function accountModel(
  fallback: ModelProvider,
  secret: (id: string, provider: string) => Promise<string | null>,
  openai: (key: string) => ModelProvider,
): {
  model: ModelProvider;
  wrap: (worker: Worker, owner: (sessionId: string) => Promise<string | null>) => Worker;
} {
  const owners = new AsyncLocalStorage<string>();
  return {
    model: {
      name: 'account-selected',
      model: fallback.model,
      async complete(request, signal) {
        const id = owners.getStore();
        if (!id) throw new ModelError('auth', 'model account context unavailable');
        // Read/decrypt under identity's lock, release it before any provider request.
        // No cached plaintext: replacement and suspension apply to the next call.
        const key = await secret(id, 'openai');
        return (key === null ? fallback : openai(key)).complete(request, signal);
      },
    },
    wrap: (worker, owner) => ({
      async run(task, input, report) {
        const id = await owner(task.sessionId);
        if (!id) throw new ModelError('auth', 'model account context unavailable');
        await owners.run(id, () => worker.run(task, input, report));
      },
    }),
  };
}
