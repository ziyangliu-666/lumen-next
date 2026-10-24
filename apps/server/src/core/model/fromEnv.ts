import { nullModel } from './nullModel.js';
import { OpenAICompatible } from './openaiCompatible.js';
import { priceOf } from './pricing.js';
import type { ModelProvider } from './provider.js';

// The provider a process runs with, from its environment. One setting picks
// the vendor, one names the model, and the key comes from the vendor's usual
// variable, so a developer who already has OPENAI_API_KEY set is done.

export const PROVIDERS = ['openai', 'deepseek', 'none'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/** The default model for each vendor, for the demo and the tests. */
const DEFAULT_MODEL: Record<Exclude<ProviderName, 'none'>, string> = {
  openai: 'gpt-4.1-mini',
  deepseek: 'deepseek-flash',
};

/**
 * The models a session may choose, from LUMEN_MODELS ("gpt-4.1-mini,
 * gpt-4.1"): the same vendor and key as the default, each its own model
 * name. The default (LUMEN_MODEL, or the vendor's default) comes first. Each
 * must have a price row, or its calls could not be charged: the process
 * refuses to start rather than run a model it cannot bill. Unset, there is
 * no choice and the list holds the default alone.
 */
export function modelChoicesFromEnv(
  env: Record<string, string | undefined>,
): ReadonlyMap<string, ModelProvider> {
  const fallback = modelFromEnv(env);
  const listed = (env['LUMEN_MODELS'] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (fallback === nullModel || listed.length === 0) return new Map([[fallback.model, fallback]]);
  const names = [fallback.model, ...listed.filter((name) => name !== fallback.model)];
  const choices = new Map<string, ModelProvider>();
  for (const name of names) {
    if (!priceOf(name)) {
      throw new Error(`LUMEN_MODELS: no price for "${name}"; add it to core/model/pricing.ts`);
    }
    choices.set(
      name,
      name === fallback.model ? fallback : modelFromEnv({ ...env, LUMEN_MODEL: name }),
    );
  }
  return choices;
}

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
