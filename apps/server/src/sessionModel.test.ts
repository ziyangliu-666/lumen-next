import { describe, expect, it } from 'vitest';
import type { Task } from '@lumen/contracts';
import type { WorkerReport } from './core/domain/worker.js';
import { modelChoicesFromEnv, type ModelProvider } from './core/model/index.js';
import { sessionModel } from './sessionModel.js';

function named(model: string): ModelProvider {
  return {
    name: 'test',
    model,
    complete: () =>
      Promise.resolve({
        text: model,
        toolCalls: [],
        stopReason: 'end',
        model,
        usage: { inputTokens: 0, outputTokens: 0 },
        cost: { dollars: 0 },
        durationMs: 0,
      }),
  };
}

describe('the model a session chose', () => {
  it("sends each call of a session's tasks to its model, and the rest to the default", async () => {
    const choices = new Map([
      ['small', named('small')],
      ['large', named('large')],
    ]);
    const { model, wrap } = sessionModel(choices, named('small'));
    const seen: string[] = [];
    const worker = wrap(
      {
        run: async () =>
          void seen.push((await model.complete({ system: '', messages: [], maxTokens: 1 })).model),
      },
      (sessionId) => Promise.resolve(sessionId === 's-large' ? 'large' : undefined),
    );
    const task = (sessionId: string) => ({ id: 't', sessionId }) as Task;
    await worker.run(task('s-large'), 'x', {} as WorkerReport);
    await worker.run(task('s-plain'), 'x', {} as WorkerReport);
    expect(seen).toEqual(['large', 'small']);
  });

  it('reads the choices from LUMEN_MODELS, the default first, and refuses a model with no price', () => {
    const env = {
      LUMEN_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: 'x',
      LUMEN_MODELS: 'gpt-4.1-mini, gpt-4.1-nano',
    };
    expect([...modelChoicesFromEnv(env).keys()]).toEqual(['gpt-4.1-nano', 'gpt-4.1-mini']);
    expect([...modelChoicesFromEnv({ ...env, LUMEN_MODELS: '' }).keys()]).toEqual(['gpt-4.1-nano']);
    expect(() => modelChoicesFromEnv({ ...env, LUMEN_MODELS: 'gpt-9-unpriced' })).toThrow(
      /no price/,
    );
  });
});
