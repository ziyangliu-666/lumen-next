import type { Finding, Money, SessionSummary } from '@lumen/contracts';

/** Internal preparation only: not yet a wire contract or a persistence port. */
export interface VisitActivity {
  readonly sessionsEnded: number;
  readonly findingsAdded: number;
  readonly spend: Money | null;
}

/** Persistence must apply this monotonically in an atomic write when connected. */
export function nextVisitAt(createdAt: number, lastOpenedAt: number | null, now: number): number {
  return Math.max(createdAt, lastOpenedAt ?? createdAt, now);
}

/**
 * Caller supplies only an authorized project's records and an authoritative
 * spend aggregate over the same window. Never infer interval spend from session
 * totals. Null preserves unavailable spend until its public port is agreed.
 */
export function activitySinceVisit(input: {
  readonly createdAt: number;
  readonly lastOpenedAt: number | null;
  readonly asOf: number;
  readonly sessions: readonly Pick<SessionSummary, 'endedAt'>[];
  readonly findings: readonly Pick<Finding, 'createdAt'>[];
  readonly spend: Money | null;
}): VisitActivity {
  const inWindow = (at: number): boolean =>
    at <= input.asOf &&
    (input.lastOpenedAt === null ? at >= input.createdAt : at > input.lastOpenedAt);
  return {
    sessionsEnded: input.sessions.filter((session) =>
      session.endedAt === null ? false : inWindow(session.endedAt),
    ).length,
    findingsAdded: input.findings.filter((finding) => inWindow(finding.createdAt)).length,
    spend: input.spend === null ? null : { ...input.spend },
  };
}
