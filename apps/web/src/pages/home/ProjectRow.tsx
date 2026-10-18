import { useState, type JSX } from 'react';
import { request } from '@/core/api';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
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
  // The name as last saved here, until the list is read again.
  const [saved, setSaved] = useState<string | null>(null);
  const name = saved ?? card.project.title;
  // The name being typed, or null when the row is not being renamed.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  async function rename(): Promise<void> {
    const next = renaming?.trim() ?? '';
    if (!next || next === name) {
      setRenaming(null);
      return;
    }
    try {
      const reply = await request<{ project: { title: string } }>(
        `/api/projects/${encodeURIComponent(card.project.id)}`,
        { method: 'PATCH', json: { title: next } },
      );
      setSaved(reply.project.title);
      setRenaming(null);
      setRenameError(null);
    } catch {
      setRenameError('The name was not saved. Try again.');
    }
  }
  if (renaming !== null) {
    return (
      <li className="relative border-t border-rule-minor bg-paper/90 py-4 first:border-t-0">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <Input
            aria-label="Project name"
            value={renaming}
            maxLength={120}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the person's own click on Rename
            autoFocus
            onChange={(event) => setRenaming(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRenaming(null);
            }}
            className="flex-1 font-semibold"
          />
          <Button type="submit" size="sm" disabled={!renaming.trim()}>
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
        </form>
        {renameError ? (
          <p role="alert" className="mt-2 text-sm text-ink">
            {renameError}
          </p>
        ) : null}
      </li>
    );
  }
  const title = (
    // One line: the names of older projects are whole questions, and two
    // lines of each made the list a wall. The full name is the tooltip.
    <h3 title={name} className="line-clamp-1 pr-10 text-base font-semibold break-words text-ink">
      {/* An inline block, so the title flies into the session's breadcrumb
          as its own words: the full-width heading would be squeezed into
          the breadcrumb's width on the way. It carries the hover underline,
          because an underline on the heading does not reach into it. */}
      <span
        data-flight=""
        className="inline-block decoration-[1.5px] underline-offset-[0.15em] group-hover:underline"
      >
        {name}
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
        // On paper: over the scene's sphere the row's small text could not
        // be read. The scene shows only where the list is not.
        'group/row relative border-t border-rule-minor bg-paper/90 py-4 first:border-t-0',
        showingFindings &&
          'before:absolute before:inset-y-3 before:-left-3 before:w-0.5 before:bg-ink',
      )}
    >
      {/* Rename, as chat products rename a chat: a quiet pencil by the name,
          shown on hover or focus. Above the row's stretched open target. */}
      <button
        type="button"
        aria-label={`Rename ${name}`}
        title="Rename"
        onClick={() => {
          setRenameError(null);
          setRenaming(name);
        }}
        className="absolute top-3.5 right-0 z-10 grid size-8 place-items-center text-ink-2 opacity-0 group-hover/row:opacity-100 hover:bg-well hover:text-ink focus-visible:opacity-100"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
          <path
            d="M4 16h3l8.5-8.5-3-3L4 13v3zM11 6l3 3"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      </button>
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
      {session ? null : (
        <p className="mt-1 max-w-[44em] text-sm text-ink-2">
          Session creation has not been confirmed. Refresh to check its outcome before starting
          another project.
        </p>
      )}
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
        <ProjectActivity lastOpenedAt={card.lastOpenedAt} activity={card.sinceLastVisit} />
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
