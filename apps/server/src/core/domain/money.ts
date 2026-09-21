import type { Money } from '@lumen/contracts';

// One rule for an amount of money that is about to be recorded, used by every
// slice that records one. The column is numeric(12,6), so that is the rule.

const SCALE = 1_000_000;
const MAX_DOLLARS = 999_999.999999;

/**
 * The amount as the database will hold it: six decimals. A worker works its
 * cost out in JS, and 0.1 + 0.2 there is 0.30000000000000004; the ninth decimal
 * is an artefact of the float, not money anybody spent. Rounding here, once, at
 * the door, is the honest reading of it. Everything after the door sums in SQL.
 *
 * Throws for what no rounding can make an amount: not a number, not finite,
 * negative, or too large for the column.
 */
export function recordable(amount: Money): Money {
  const { dollars } = amount;
  if (typeof dollars !== 'number' || !Number.isFinite(dollars) || dollars < 0) {
    throw new Error(`money: an amount must be a non-negative number, got ${String(dollars)}`);
  }
  const rounded = Math.round(dollars * SCALE) / SCALE;
  if (rounded > MAX_DOLLARS) {
    throw new Error(`money: ${dollars} is more than the ledger can hold`);
  }
  return { dollars: rounded };
}
