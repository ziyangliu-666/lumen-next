import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { RunState, type Run } from '@/ui/run-state';
import { sessionLink, type ProjectCard } from './api';
import { ago } from './ago';
import { OpenProjectButton } from './OpenProjectButton';
import { ProjectActivity } from './ProjectActivity';

// One project is one row: its name first, at the margin, because the name is
// what a person scans for. Under it, what changed, and then one meta line:
// the run state, what the latest session cost, and when the project last
// moved. The line is the same at every width; before, the state had a 160px
// column of its own on a wide screen and moved under the name on a phone, so
// one row had two layouts. The run state opens the meta line, so the one red
// dot is still on one straight line down the list.

/**
 * The run state of a card's latest session. RunState has four marks, and a
 * project can be in six states or have no session, so the server's own label
 * names the ones that share a mark: queued turns like running, because it is
 * on its way; failed and an unconfirmed session sit on the stopped ring,
 * because nothing runs. Failed is not red: red only means "waits on you".
 */
export function runOf(card: ProjectCard): { state: Run; word?: string } {
  switch (card.latestSession?.status) {
    case 'waiting':
      return { state: 'waiting' };
    case 'running':
      return { state: 'running' };
    case 'queued':
      return { state: 'running', word: card.label };
    case 'ended':
      return { state: 'finished' };
    case 'stopped':
      return { state: 'stopped' };
    default:
      return { state: 'stopped', word: card.label };
  }
}

export function ProjectRow({
  card,
  now,
  showingFindings,
  onShowFindings,
  stopping,
  onStop,
}: {
  readonly card: ProjectCard;
  readonly now: number;
  readonly showingFindings: boolean;
  readonly onShowFindings: () => void;
  /** Which project has a stop request in flight, if any. One at a time. */
  readonly stopping: string | null;
  readonly onStop: () => void;
}): JSX.Element {
  const run = runOf(card);
  const session = card.latestSession;
  const title = (
    <h3 className="text-base font-semibold break-words text-ink">
      {/* An inline block, so the title flies into the session's breadcrumb
          as its own words: the full-width heading would be squeezed into
          the breadcrumb's width on the way. It carries the hover underline,
          because an underline on the heading does not reach into it. */}
      <span
        data-flight=""
        className="inline-block decoration-[1.5px] underline-offset-[0.15em] group-hover:underline"
      >
        {card.project.title}
      </span>
    </h3>
  );
  return (
    // The row whose findings the well shows has a 2px ink rule in the margin
    // on its left, and its button says so. It has no fill: a grey fill read
    // as hover or as unread, and it stood out past the search field and the
    // Refresh button above it.
    <li
      className={cn(
        'relative border-t border-rule-minor py-4 first:border-t-0',
        showingFindings &&
          'before:absolute before:inset-y-3 before:-left-3 before:w-0.5 before:bg-ink',
      )}
    >
      {card.actions.openSession && session ? (
        <OpenProjectButton
          variant="plain"
          projectId={card.project.id}
          target={sessionLink(session.id)}
        >
          {title}
        </OpenProjectButton>
      ) : (
        title
      )}
      <div className="mt-1 max-w-[44em] space-y-1">
        <ProjectActivity lastOpenedAt={card.lastOpenedAt} activity={card.sinceLastVisit} />
        {session ? null : (
          <p className="text-sm text-ink-2">
            Session creation has not been confirmed. Refresh to check its outcome before starting
            another project.
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
        <RunState state={run.state}>{run.word}</RunState>
        <span className="font-medium text-ink" title="Spent by the latest session">
          {session ? `$${session.spend.dollars.toFixed(4)} spent` : 'No session yet'}
        </span>
        <span className="text-ink-2">
          Updated{' '}
          <time
            dateTime={new Date(card.lastActivityAt).toISOString()}
            title={new Date(card.lastActivityAt).toLocaleString()}
          >
            {ago(card.lastActivityAt, now)}
          </time>
        </span>
      </div>
      {/* Above the row's stretched open target, so these still get their clicks. */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 empty:hidden">
        {/* A button that looks like one: underlined, it looked like the link
            to the project, but it only changes what the well shows. */}
        {card.findingsCount > 0 || showingFindings ? (
          <Button variant="outline" size="sm" onClick={onShowFindings}>
            {showingFindings
              ? 'Hide findings'
              : `Show ${card.findingsCount} ${card.findingsCount === 1 ? 'finding' : 'findings'}`}
          </Button>
        ) : null}
        {card.actions.stopLatestSession && (
          <Button variant="outline" size="sm" disabled={stopping !== null} onClick={onStop}>
            {stopping === card.project.id ? 'Requesting…' : 'Stop latest session'}
          </Button>
        )}
      </div>
    </li>
  );
}
