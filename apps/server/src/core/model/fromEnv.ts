import { nullModel } from './nullModel.js';
import { OpenAICompatible } from './openaiCompatible.js';
import type { ModelProvider } from './provider.js';

// The provider a process runs with, from its environment. One setting picks
// the vendor, one names the model, and the key comes from the vendor's usual
// variable, so a developer who already has OPENAI_API_KEY set is done.

export const PROVIDERS = ['openai', 'deepseek', 'none'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/** The cheapest model each vendor sells, for the demo and the tests. */
const DEFAULT_MODEL: Record<Exclude<ProviderName, 'none'>, string> = {
  openai: 'gpt-4.1-nano',
  deepseek: 'deepseek-flash',
};

export function modelFromEnv(env: Record<string, string | undefined>): ModelProvider {
  const raw = env['LUMEN_MODEL_PROVIDER'] ?? 'none';
  if (!(PROVIDERS as readonly string[]).includes(raw)) {
    throw new Error(`LUMEN_MODEL_PROVIDER must be one of ${PROVIDERS.join(', ')}, got "${raw}"`);
  }
  const name = raw as ProviderName;
  if (name === 'none') return nullModel;
  const model = env['LUMEN_MODEL'] || DEFAULT_MODEL[name];
  if (name === 'openai') {
    return new OpenAICompatible({
      name,
      model,
      baseUrl: env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1',
      apiKey: env['OPENAI_API_KEY'] ?? '',
      maxTokensField: 'max_completion_tokens',
    });
  }
  return new OpenAICompatible({
    name,
    model,
    baseUrl: env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com',
    apiKey: env['DEEPSEEK_API_KEY'] ?? '',
    maxTokensField: 'max_tokens',
  });
}
