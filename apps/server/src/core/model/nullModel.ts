import type { Completion, ModelProvider, ModelRequest } from './provider.js';

/**
 * The provider that does nothing: one fixed line, no tokens, no cost, no
 * network. What CI, a demo without a key, and every test that is not about a
 * vendor run against. It answers instantly, so a test never waits.
 */
export const nullModel: ModelProvider = {
  name: 'none',
  model: 'none',
  complete(request: ModelRequest): Promise<Completion> {
    const last = request.messages.at(-1)?.content ?? '';
    return Promise.resolve({
      text: `No model is configured. The last message was: "${last.slice(0, 80)}"`,
      toolCalls: [],
      stopReason: 'end',
      usage: { inputTokens: 0, outputTokens: 0 },
      cost: { dollars: 0 },
      model: 'none',
      durationMs: 0,
    });
  },
};
