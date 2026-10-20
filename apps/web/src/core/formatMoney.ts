import type { Money } from '@lumen/contracts';

/** Preserve stored microdollars while keeping at least four decimal places. */
export function formatMoney(value: Money): string {
  return value.dollars.toFixed(6).replace(/0{1,2}$/, '');
}
