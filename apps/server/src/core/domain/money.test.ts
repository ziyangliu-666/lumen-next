import { describe, expect, it } from 'vitest';
import { recordable } from './money.js';

describe('core: a recordable amount', () => {
  it('reads a float artefact as the six decimals it stands for', () => {
    expect(recordable({ dollars: 0.1 + 0.2 })).toEqual({ dollars: 0.3 });
    expect(recordable({ dollars: 0.0000004 })).toEqual({ dollars: 0 });
    expect(recordable({ dollars: 0.0000005 })).toEqual({ dollars: 0.000001 });
    expect(recordable({ dollars: 12.5 })).toEqual({ dollars: 12.5 });
  });

  it('refuses what no rounding can make an amount', () => {
    expect(() => recordable({ dollars: -0.01 })).toThrow(/non-negative/);
    expect(() => recordable({ dollars: Number.NaN })).toThrow(/non-negative/);
    expect(() => recordable({ dollars: Number.POSITIVE_INFINITY })).toThrow(/non-negative/);
    expect(() => recordable({ dollars: 1_000_000 })).toThrow(/more than the ledger/);
    expect(() => recordable({ dollars: '1' as unknown as number })).toThrow(/non-negative/);
  });
});
