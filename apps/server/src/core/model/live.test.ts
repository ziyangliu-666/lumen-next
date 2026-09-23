import { describe, expect, it } from 'vitest';
import { modelFromEnv } from './fromEnv.js';

// The one test that spends money: a few tokens on each vendor's cheapest
// model, only when its key is in the environment. It proves the wire shape
// against the real thing, which no recording can. CI has no key and skips it.

const VENDORS = [
  ['openai', 'OPENAI_API_KEY'],
  ['deepseek', 'DEEPSEEK_API_KEY'],
] as const;

for (const [name, keyVar] of VENDORS) {
  describe.skipIf(!process.env[keyVar])(`core/model: live, ${name}`, () => {
    it('answers a one-word question, counts its tokens and prices them', async () => {
      const provider = modelFromEnv({ LUMEN_MODEL_PROVIDER: name, [keyVar]: process.env[keyVar] });
      const reply = await provider.complete({
        system: 'Answer with one English word and nothing else.',
        messages: [{ role: 'user', content: 'What colour is a clear daytime sky?' }],
        // A reasoning model (deepseek-flash) spends the cap on its reasoning
        // first: 16 tokens gave an empty answer and finish_reason 'length'.
        maxTokens: 256,
      });

      expect(reply.text.toLowerCase()).toContain('blue');
      expect(reply.usage.inputTokens).toBeGreaterThan(0);
      expect(reply.usage.outputTokens).toBeGreaterThan(0);
      expect(reply.cost.dollars).toBeGreaterThan(0);
      expect(reply.cost.dollars).toBeLessThan(0.001);
      expect(reply.model).toContain(provider.model.split('-')[0] ?? '');
    }, 60_000);

    it('calls a tool when the question needs one', async () => {
      const provider = modelFromEnv({ LUMEN_MODEL_PROVIDER: name, [keyVar]: process.env[keyVar] });
      const reply = await provider.complete({
        system: 'You must use the search tool to answer. Never answer from memory.',
        messages: [{ role: 'user', content: 'Search for: pop-stack sorting preimages' }],
        tools: [
          {
            name: 'search',
            description: 'Search the literature.',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
        maxTokens: 256,
      });

      expect(reply.stopReason).toBe('tool');
      expect(reply.toolCalls[0]?.name).toBe('search');
      expect(String(reply.toolCalls[0]?.arguments['query'])).toMatch(/pop-stack/i);
    }, 60_000);
  });
}
