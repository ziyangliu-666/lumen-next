import type { SessionSummary } from '@lumen/contracts';

/** SessionDirectory supplies SQL-aggregated totals; combine at numeric(12,6) precision. */
export function cumulativeSpend(sessions: readonly Pick<SessionSummary, 'spend'>[]): number {
  return sessions.reduce((sum, session) => sum + Math.round(session.spend.dollars * 1e6), 0) / 1e6;
}

export function spendSinceVisit(cumulative: number, baseline: number): number {
  return Math.max(0, Math.round(cumulative * 1e6) - Math.round(baseline * 1e6)) / 1e6;
}

export function sessionsEndedSince(
  sessions: readonly Pick<SessionSummary, 'endedAt'>[],
  since: number,
): number {
  return sessions.filter((session) => session.endedAt !== null && session.endedAt > since).length;
}
