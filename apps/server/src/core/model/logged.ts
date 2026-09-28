import type { Log } from '../log/log.js';
import { ModelError, type ModelProvider } from './provider.js';

/**
 * The same provider, with every call written to the log: which model, how
 * many tokens, what it cost, how long, and why it failed. The text of the
 * prompt and of the answer is not written. A worker wraps the model it was
 * given with the task's own log, so the line carries the task's ids.
 */
export function withLog(provider: ModelProvider, log: Log): ModelProvider {
  return {
    name: provider.name,
    model: provider.model,
    async complete(request, signal) {
      const startedAt = Date.now();
      try {
        const reply = await provider.complete(request, signal);
        log.info(
          {
            provider: provider.name,
            model: reply.model,
            inputTokens: reply.usage.inputTokens,
            outputTokens: reply.usage.outputTokens,
            cost: reply.cost.dollars,
            durationMs: reply.durationMs,
            stopReason: reply.stopReason,
            toolCalls: reply.toolCalls.length,
          },
          'model call',
        );
        return reply;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (error instanceof ModelError) {
          log.warn(
            {
              provider: provider.name,
              model: provider.model,
              kind: error.kind,
              status: error.status,
              durationMs,
            },
            'model call failed',
          );
        } else {
          log.error(
            { provider: provider.name, model: provider.model, err: error, durationMs },
            'model call failed',
          );
        }
        throw error;
      }
    },
  };
}
