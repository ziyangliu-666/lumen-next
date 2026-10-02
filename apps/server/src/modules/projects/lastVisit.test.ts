import { describe, expect, it } from 'vitest';
import { cumulativeSpend, spendSinceVisit, sessionsEndedSince } from './lastVisit.js';

describe('last-visit activity', () => {
  it('counts endings strictly after the visit and ignores running sessions', () => {
    expect(sessionsEndedSince([{ endedAt: null }, { endedAt: 20 }, { endedAt: 21 }], 20)).toBe(1);
  });
  it('combines all session totals at six decimal places, including running work', () => {
    expect(
      cumulativeSpend([
        { spend: { dollars: 0.1 } },
        { spend: { dollars: 0.2 } },
        { spend: { dollars: 0.000001 } },
      ]),
    ).toBe(0.300001);
    expect(spendSinceVisit(0.300001, 0.1)).toBe(0.200001);
  });
  it('returns zero for no changes and never reports negative spend', () => {
    expect(cumulativeSpend([])).toBe(0);
    expect(spendSinceVisit(0.1, 0.1)).toBe(0);
    expect(spendSinceVisit(0.1, 0.2)).toBe(0);
  });
});
