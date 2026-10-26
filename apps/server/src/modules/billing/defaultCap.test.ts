import { describe, expect, it } from 'vitest';
import { defaultCap } from './ledger.js';

describe('billing: the default cap of a new account', () => {
  it('is 1 dollar unless BILLING_DEFAULT_CAP sets it', () => {
    expect(defaultCap(undefined)).toBe('1.000000');
    expect(defaultCap('  ')).toBe('1.000000');
    expect(defaultCap('0.05')).toBe('0.05');
  });

  it('accepts only a plain amount, because it goes into SQL as text', () => {
    for (const bad of ['-1', '1e3', '0.0000001', '1; drop table x', 'abc', '1234567']) {
      expect(() => defaultCap(bad)).toThrow(/BILLING_DEFAULT_CAP/);
    }
  });
});
