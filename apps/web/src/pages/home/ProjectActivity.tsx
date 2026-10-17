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
 * Confirmed server activity; navigation records the visit before leaving Home.
 * It is the row's summary, so it reads as sentences, not as a meta string.
 * Only what changed is counted: a row with nothing new says so in one short
 * sentence, instead of "0 sessions ended, 0 findings added, $0.0000 spent".
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
  const changed =
    activity.sessionsEnded > 0 ||
    activity.findingsAdded > 0 ||
    (activity.spend !== null && activity.spend.dollars > 0);
  const today =
    lastOpenedAt !== null && new Date(lastOpenedAt).toDateString() === new Date().toDateString();
  const since =
    lastOpenedAt === null ? (
      'Since project creation'
    ) : (
      <>
        Since your last visit {today ? 'at' : 'on'}{' '}
        <time
          dateTime={new Date(lastOpenedAt).toISOString()}
          title={new Date(lastOpenedAt).toLocaleString()}
        >
          {visitTime(lastOpenedAt)}
        </time>
      </>
    );
  // Nothing new is said by saying nothing: the row's state and age already
  // tell a returning reader that the project has not moved.
  if (!changed && activity.spend !== null) return null;
  const counts = [
    activity.sessionsEnded > 0
      ? `${activity.sessionsEnded} ${activity.sessionsEnded === 1 ? 'session' : 'sessions'} ended`
      : null,
    activity.findingsAdded > 0
      ? `${activity.findingsAdded} ${activity.findingsAdded === 1 ? 'finding' : 'findings'} added`
      : null,
  ].filter((part): part is string => part !== null);
  return (
    <p className="text-sm text-ink-2">
      {changed && <span className="mr-2 font-semibold text-ink">New activity</span>}
      {since}
      {counts.length > 0 ? `: ${counts.join(', ')}` : null}
      {activity.spend === null ? (
        `${counts.length > 0 ? '.' : ':'} Spend unavailable.`
      ) : activity.spend.dollars > 0 ? (
        <>
          {counts.length > 0 ? ', ' : ': '}
          <span className="tabular-nums">${activity.spend.dollars.toFixed(4)} spent</span>.
        </>
      ) : (
        '.'
      )}
    </p>
  );
}
