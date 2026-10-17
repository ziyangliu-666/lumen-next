import { describe, expect, it } from 'vitest';
import { ago } from './ago';

const NOW = Date.UTC(2026, 9, 17, 12);
const MIN = 60_000;

describe('Home relative age', () => {
  it.each([
    [0, 'just now'],
    [4 * MIN, '4 min ago'],
    [2 * 60 * MIN, '2 h ago'],
    [30 * 60 * MIN, 'yesterday'],
    [3 * 24 * 60 * MIN, '3 days ago'],
    [8 * 24 * 60 * MIN, 'last week'],
  ])('says %i ms ago as "%s"', (elapsed, words) => {
    expect(ago(NOW - elapsed, NOW)).toBe(words);
  });
  it('never says a time in the future, so clock skew reads as just now', () => {
    expect(ago(NOW + 5 * MIN, NOW)).toBe('just now');
  });
  it('gives a date once the age stops being useful', () => {
    expect(ago(NOW - 30 * 24 * 60 * MIN, NOW)).toMatch(/^on .*2026/);
  });
});
