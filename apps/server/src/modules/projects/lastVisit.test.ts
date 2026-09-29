import { describe, expect, it } from 'vitest';
import { activitySinceVisit, nextVisitAt } from './lastVisit.js';

describe('last-visit activity preparation', () => {
  it('counts only events after the visit and through the snapshot time', () => {
    expect(
      activitySinceVisit({
        createdAt: 10,
        lastOpenedAt: 20,
        asOf: 40,
        sessions: [
          { endedAt: null },
          { endedAt: 20 },
          { endedAt: 21 },
          { endedAt: 40 },
          { endedAt: 41 },
        ],
        findings: [{ createdAt: 20 }, { createdAt: 25 }, { createdAt: 41 }],
        spend: { dollars: 0.123456 },
      }),
    ).toEqual({ sessionsEnded: 2, findingsAdded: 1, spend: { dollars: 0.123456 } });
  });

  it('includes creation-time events for a project that has never been opened', () => {
    expect(
      activitySinceVisit({
        createdAt: 10,
        lastOpenedAt: null,
        asOf: 20,
        sessions: [{ endedAt: 9 }, { endedAt: 10 }],
        findings: [{ createdAt: 9 }, { createdAt: 10 }],
        spend: null,
      }),
    ).toEqual({ sessionsEnded: 1, findingsAdded: 1, spend: null });
  });

  it('clears previously seen events while retaining later work', () => {
    const input = {
      createdAt: 10,
      asOf: 40,
      sessions: [{ endedAt: 25 }],
      findings: [{ createdAt: 25 }, { createdAt: 35 }],
      spend: null,
    };
    const lastOpenedAt = nextVisitAt(10, 20, 30);
    expect(activitySinceVisit({ ...input, lastOpenedAt })).toEqual({
      sessionsEnded: 0,
      findingsAdded: 1,
      spend: null,
    });
  });

  it('never moves the visit backwards for a late request or a clock rollback', () => {
    expect(nextVisitAt(10, null, 5)).toBe(10);
    expect(nextVisitAt(10, 30, 20)).toBe(30);
    expect(nextVisitAt(10, 30, 40)).toBe(40);
  });

  it('distinguishes unknown spend from confirmed zero', () => {
    const input = { createdAt: 10, lastOpenedAt: 20, asOf: 30, sessions: [], findings: [] };
    expect(activitySinceVisit({ ...input, spend: null }).spend).toBeNull();
    expect(activitySinceVisit({ ...input, spend: { dollars: 0 } }).spend).toEqual({ dollars: 0 });
  });
});
