// Owner: PENG XUJIAN. Page: Home.
import { useState, type JSX, type ReactNode } from 'react';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ScrollRegion } from '@/ui/scroll-region';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { RegionName, SurfaceMain, Surfaces, SurfaceWell } from '@/ui/surfaces';
import { request } from '@/core/api';
import { useCurrentAccount } from '@/core/auth';
import { PageCrumb } from '@/core/shell';
import type { ProjectCard } from './api';
import { Findings } from './Findings';
import { focusNewProject, NewProject } from './NewProject';
import { ProjectRow } from './ProjectRow';
import { usePages } from './usePages';
import { useNow } from './ago';

// The signed-in projects page, on the two surfaces. Paper, columns 1 to 7:
// the projects, the one waiting on you first. The well, columns 8 to 12: a
// new project, then what the projects found lately. Below 1080px it is one
// column, projects first, and a New project button jumps to the form.

const pollDelay = (items: readonly ProjectCard[]): number | null => {
  const delays = items.flatMap((card) => (card.pollAfterMs === null ? [] : [card.pollAfterMs]));
  return delays.length ? Math.min(...delays) : null;
};
// The words of RunState and the session page, so a filter and a row say the
// same thing. "Waiting", "Queued" and "Awaiting session" could not be told
// apart.
const LABELS: Record<string, string> = {
  all: 'All statuses',
  waiting: 'Waiting on you',
  queued: 'Queued to start',
  ended: 'Finished',
  pending: 'No session yet',
};
const STATUSES = ['all', 'running', 'waiting', 'ended', 'stopped', 'failed', 'queued', 'pending'];
// The split width from theme.css: over it, the well stands beside the list.
const SPLIT = '(min-width: 67.5625rem)';

/** A message on its own, for the states before there is a list to show. */
function Notice({ children }: { children: ReactNode }): JSX.Element {
  return <section className="max-w-xl space-y-4 pt-10">{children}</section>;
}

export function Home(): JSX.Element {
  const { state: auth, refresh } = useCurrentAccount();
  if (auth.status === 'loading')
    return (
      <p role="status" className="text-ink-2">
        Checking your account…
      </p>
    );
  if (auth.status === 'error')
    return (
      <Notice>
        <h1 className="text-xl font-semibold text-ink">Unable to check your account</h1>
        <p role="alert" className="text-ink-2">
          The server could not confirm who is signed in.
        </p>
        <Button onClick={refresh}>Try again</Button>
      </Notice>
    );
  if (auth.status === 'signed-out')
    return (
      <Notice>
        <h1 className="text-xl font-semibold text-ink">Your projects</h1>
        <p className="text-ink-2">
          {auth.mode === 'stub'
            ? 'Choose a development account on Landing to see your projects.'
            : 'Sign in from Landing to see your projects.'}
        </p>
        <Button asChild>
          <a href="#/">Continue to Landing</a>
        </Button>
      </Notice>
    );
  // A different account or mode must never reuse another account's loaded pages.
  return (
    <HomeProjects key={JSON.stringify([auth.mode, auth.account.id])} onUnauthorized={refresh} />
  );
}

function HomeProjects({ onUnauthorized }: { onUnauthorized: () => void }): JSX.Element {
  const state = usePages<ProjectCard>('/api/projects', pollDelay);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  // Whose findings the well shows. Undefined until a person picks: the well
  // then shows the first project's, so it is never a dead end. Null once
  // they put the findings away.
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [stopping, setStopping] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const visible = state.items.filter(
    (card) =>
      card.project.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (status === 'all' ||
        card.latestSession?.status === status ||
        (status === 'pending' && !card.latestSession)),
  );
  // The one waiting on you comes first. The sort is stable, so the rest keep
  // the server's order, which is the most recent activity first.
  const ordered = [...visible].sort(
    (a, b) =>
      Number(b.latestSession?.status === 'waiting') - Number(a.latestSession?.status === 'waiting'),
  );
  // The well shows the findings of the project you picked from its row. The
  // server has no list of findings across projects, and opening one stream
  // per project would poll every project at once, so nothing loads until a
  // person asks for one project's findings.
  const findingsCard =
    selected === undefined
      ? ordered.find((card) => card.findingsCount > 0)
      : state.items.find((card) => card.project.id === selected);
  const now = useNow();

  function showFindings(card: ProjectCard): void {
    // A second press puts the findings away again.
    if (findingsCard?.project.id === card.project.id) {
      setSelected(null);
      return;
    }
    setSelected(card.project.id);
    // Below the split width the well sits under the list, so take the reader
    // to it; over it, the findings are already in view beside the row.
    if (!window.matchMedia(SPLIT).matches)
      window.requestAnimationFrame(() =>
        document.getElementById('latest-findings-name')?.scrollIntoView({ block: 'start' }),
      );
  }

  async function stop(card: ProjectCard): Promise<void> {
    if (stopping) return;
    setStopping(card.project.id);
    setStopError(null);
    setNotice(null);
    try {
      const result = await request<{ outcome: string }>(
        `/api/projects/${encodeURIComponent(card.project.id)}/stop`,
        { method: 'POST' },
      );
      setNotice(
        result.outcome === 'stop_requested'
          ? 'Stop requested. Refreshing to confirm the session outcome.'
          : 'There is no active latest session to stop.',
      );
    } catch (failure: unknown) {
      setStopError(
        failure instanceof Error
          ? failure.message
          : 'Stop request failed. Refresh before trying again.',
      );
    } finally {
      setStopping(null);
      state.refresh();
    }
  }

  return (
    <>
      <PageCrumb />
      <Surfaces collapse="stack">
        <SurfaceMain>
          {/* The same height as the new-project heading row on the well, so
              the two region names stand on one line across the split. */}
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
            <RegionName id="projects-name" count={state.items.length} className="mb-0">
              Projects
            </RegionName>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={state.refresh} disabled={state.loading}>
                {state.loading ? 'Refreshing…' : state.error ? 'Retry' : 'Refresh'}
              </Button>
              {/* The same secondary button as Refresh beside it: as bare
                  text it did not read as something to press. */}
              <Button
                variant="outline"
                size="sm"
                className="split:hidden"
                onClick={focusNewProject}
              >
                New project
              </Button>
            </div>
          </div>
          {state.items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              <Input
                aria-label="Search projects"
                placeholder="Search projects"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 min-w-48 flex-1 text-sm"
              />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger
                  aria-label="Session status"
                  className="h-8! w-full text-sm roomy:w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="mt-3 space-y-2 empty:hidden">
            {state.error && (
              <Alert
                title="The projects could not be loaded"
                action={
                  state.unauthorized ? (
                    <Button asChild variant="outline" size="sm">
                      <a href="#/">Continue to sign in</a>
                    </Button>
                  ) : null
                }
              >
                {state.error}{' '}
                {state.paused ? 'Automatic retries paused. Choose Retry to try again. ' : null}
                {state.unauthorized ? null : 'Any projects loaded before are kept below.'}
              </Alert>
            )}
            {stopError && <Alert title="The session was not stopped">{stopError}</Alert>}
            {notice && (
              <p role="status" className="text-sm text-ink-2">
                {notice}
              </p>
            )}
          </div>
          <ScrollRegion
            as="section"
            aria-labelledby="projects-name"
            aria-busy={state.loading}
            // The region reaches 12px past the text on the left, so the rule
            // that marks the row shown in the well is not clipped, and into
            // the gutter on the right, so the scroll bar is not over the text.
            className="mt-4 -ml-3 min-h-0 pl-3 max-split:-mr-3 max-split:pr-3 split:-mr-gutter split:flex-1 split:pr-gutter"
          >
            {state.loading && state.items.length === 0 && (
              <p role="status" className="text-ink-2">
                Loading your projects…
              </p>
            )}
            {!state.loading && !state.error && state.items.length === 0 && (
              <div className="max-w-xl space-y-3 pt-6">
                <h3 className="text-xl font-semibold text-ink">Your next discovery starts here</h3>
                <p className="text-ink-2">
                  Start a project to explore a question and keep the findings together.
                </p>
                <Button onClick={focusNewProject}>Start your first project</Button>
              </div>
            )}
            {state.items.length > 0 && visible.length === 0 && (
              <p className="text-ink-2">No loaded projects match these filters.</p>
            )}
            {ordered.length > 0 && (
              <ol>
                {ordered.map((card) => (
                  <ProjectRow
                    key={card.project.id}
                    card={card}
                    now={now}
                    showingFindings={findingsCard?.project.id === card.project.id}
                    onShowFindings={() => showFindings(card)}
                    stopping={stopping}
                    onStop={() => {
                      void stop(card);
                    }}
                  />
                ))}
              </ol>
            )}
            {state.hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={state.loading}
                onClick={state.loadMore}
              >
                Load more projects
              </Button>
            )}
            <div className="pb-8" />
          </ScrollRegion>
        </SurfaceMain>
        <SurfaceWell aria-label="New project and latest findings">
          <NewProject onUnauthorized={onUnauthorized} />
          {findingsCard ? (
            <Findings
              key={findingsCard.project.id}
              projectId={findingsCard.project.id}
              title={findingsCard.project.title}
              pollAfterMs={findingsCard.pollAfterMs}
            />
          ) : (
            <section aria-labelledby="latest-findings-name" className="pt-8 pb-8">
              <RegionName id="latest-findings-name">Latest findings</RegionName>
              <p className="text-sm text-ink-2">No findings yet.</p>
            </section>
          )}
        </SurfaceWell>
      </Surfaces>
    </>
  );
}
