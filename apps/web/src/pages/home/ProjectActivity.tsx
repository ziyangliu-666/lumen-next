import type { JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { Badge } from '@/ui/badge';

/** Page-local preparation; mount only after the visit response is agreed and wired. */
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
}): JSX.Element {
  const changed =
    activity.sessionsEnded > 0 ||
    activity.findingsAdded > 0 ||
    (activity.spend !== null && activity.spend.dollars > 0);
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      {changed && <Badge className="bg-keep-soft text-keep">New activity</Badge>}
      <p>
        {lastOpenedAt === null ? (
          'Since project creation'
        ) : (
          <>
            Since your last visit{' '}
            <time className="font-mono" dateTime={new Date(lastOpenedAt).toISOString()}>
              {new Date(lastOpenedAt).toLocaleString()}
            </time>
          </>
        )}
      </p>
      <p>
        {activity.sessionsEnded} {activity.sessionsEnded === 1 ? 'session' : 'sessions'} ended
        {' · '}
        {activity.findingsAdded} {activity.findingsAdded === 1 ? 'finding' : 'findings'} added
        {' · '}
        {activity.spend === null ? (
          'Spend unavailable'
        ) : (
          <span className="font-mono">${activity.spend.dollars.toFixed(4)} spent</span>
        )}
      </p>
      {!changed && activity.spend !== null && (
        <p>
          {lastOpenedAt === null
            ? 'No changes since project creation'
            : 'No changes since your last visit'}
        </p>
      )}
    </div>
  );
}
