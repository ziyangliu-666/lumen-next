import type { Money } from '@lumen/contracts';
import { recordable } from '../domain/money.js';
import type { Usage } from './provider.js';

// List prices in dollars per million tokens, copied from each vendor's price
// page on the date in the comment. A price that is not here is a refusal, not
// a guess: a call that cannot be priced cannot be charged, and a call that is
// not charged is money the ledger never sees. Add the row, with its date.

export interface Price {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

const PRICES: Readonly<Record<string, Price>> = {
  // OpenAI, read 23 Sep 2026.
  'gpt-4.1-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  // Read 18 Oct 2026 (developers.openai.com/api/docs/pricing, standard tier).
  'gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-5-nano': { inputPerMillion: 0.05, outputPerMillion: 0.4 },
  'gpt-5-mini': { inputPerMillion: 0.25, outputPerMillion: 2 },
  // DeepSeek, read 23 Sep 2026.
  'deepseek-flash': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek-v4-pro': { inputPerMillion: 0.55, outputPerMillion: 2.19 },
  // Anthropic, read 17 Oct 2026, through its OpenAI-compatible endpoint.
  // Haiku 5.5 has two tiers; this is the tier for prompts up to 100,000
  // tokens. A prompt over that is billed at $0.50 / $2.50 and this row
  // undercharges it, so a run that sends such prompts needs a tiered price.
  'claude-haiku-5-5': { inputPerMillion: 0.1, outputPerMillion: 0.5 },
};

/** The price for a model, with the vendor's date suffix stripped ('gpt-4.1-nano-2025-04-14'). */
export function priceOf(model: string): Price | null {
  return PRICES[model] ?? PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, '')] ?? null;
}

/** What a call cost, as the ledger will hold it. Throws for a model with no price row. */
export function costOf(model: string, usage: Usage): Money {
  const price = priceOf(model);
  if (!price)
    throw new Error(`model pricing: no price for "${model}"; add it to core/model/pricing.ts`);
  const dollars =
    (usage.inputTokens * price.inputPerMillion + usage.outputTokens * price.outputPerMillion) /
    1_000_000;
  return recordable({ dollars });
}
