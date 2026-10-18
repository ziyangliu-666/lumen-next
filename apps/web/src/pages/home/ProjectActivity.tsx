import type { JSX } from 'react';
import type { Money } from '@lumen/contracts';

/** "Oct 17" for an earlier day, "15:32" for today: a visit minutes ago is not "on Oct 17". */
function visitTime(at: number): string {
  const date = new Date(at);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Confirmed server activity since the last visit; navigation records the
 * visit before leaving Home. It sits in the row's meta line as a short mark,
 * "New: 3 findings, 1 session ended". The full sentence ("Since your last
 * visit at 15:32 …") is the tooltip: as a line of its own under every title
 * it made the list read as a log, and the walkthrough called it cluttered.
 *
 * Only what changed is counted, and an unchanged project says nothing. Spend
 * is not repeated here, because the row shows the session's spend beside it.
 */
export function ProjectActivity({
  lastOpenedAt,
  activity,
}: {
  readonly lastOpenedAt: number | null;
  readonly activity: {
    readonly sessionsEnded: number;
    readonly findingsAdded: number;
    readonly spend: Money | null;
  };
}): JSX.Element | null {
  const counts = [
    activity.findingsAdded > 0
      ? `${activity.findingsAdded} ${activity.findingsAdded === 1 ? 'finding' : 'findings'}`
      : null,
    activity.sessionsEnded > 0
      ? `${activity.sessionsEnded} ${activity.sessionsEnded === 1 ? 'session' : 'sessions'} ended`
      : null,
  ].filter((part): part is string => part !== null);
  if (counts.length === 0) return null;
  const since =
    lastOpenedAt === null
      ? 'Since the project was created'
      : `Since your last visit, ${visitTime(lastOpenedAt)}`;
  return (
    <span className="text-ink" title={`${since}: ${counts.join(', ')}`}>
      <span className="font-semibold">New:</span> {counts.join(', ')}
    </span>
  );
}
