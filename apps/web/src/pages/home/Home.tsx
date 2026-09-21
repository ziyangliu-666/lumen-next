// Owner: PENG XUJIAN. Page: Home.
import { useState, type JSX } from 'react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { PageHeader } from '@/core/shell';
import { request } from '@/core/api';
import { sessionLink, type ProjectCard } from './api';
import { Findings } from './Findings';
import { usePages } from './usePages';

const TONE: Record<ProjectCard['tone'], string> = {
  muted: 'bg-sunken text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  decide: 'bg-decide-soft text-decide',
  keep: 'bg-keep-soft text-keep',
  gap: 'bg-gap-soft text-gap',
};
const pollDelay = (items: readonly ProjectCard[]): number | null => {
  const delays = items.flatMap((card) => (card.pollAfterMs === null ? [] : [card.pollAfterMs]));
  return delays.length ? Math.min(...delays) : null;
};
const LABELS: Record<string, string> = {
  all: 'All statuses',
  ended: 'Finished',
  pending: 'Awaiting session',
};
export function Home(): JSX.Element {
  const state = usePages<ProjectCard>('/api/projects', pollDelay);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const selectedCard = state.items.find((card) => card.project.id === selected);
  const visible = state.items.filter(
    (card) =>
      card.project.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (status === 'all' ||
        card.latestSession?.status === status ||
        (status === 'pending' && !card.latestSession)),
  );
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
      <PageHeader
        title="Projects"
        description="Pick up where your research left off."
        actions={
          <Button asChild>
            <a href="#/">New project</a>
          </Button>
        }
      />
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="project-search">Find a project</Label>
            <Input
              id="project-search"
              placeholder="Search loaded projects"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-48 space-y-2">
            <Label htmlFor="project-status">Session status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'all',
                  'running',
                  'waiting',
                  'ended',
                  'stopped',
                  'failed',
                  'queued',
                  'pending',
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={state.refresh} disabled={state.loading}>
            {state.loading ? 'Refreshing…' : state.error ? 'Retry' : 'Refresh'}
          </Button>
        </div>
        {state.error && (
          <div role="alert" className="space-y-2 rounded-md bg-gap-soft p-4 text-gap">
            <p>{state.error}</p>
            {state.paused && (
              <p className="text-sm">Automatic retries paused. Choose Retry to try again.</p>
            )}
            {state.unauthorized ? (
              <Button asChild variant="outline">
                <a href="#/">Continue to sign in</a>
              </Button>
            ) : (
              <p className="text-sm">Any previously loaded projects are kept below.</p>
            )}
          </div>
        )}
        {stopError && (
          <p role="alert" className="text-gap">
            {stopError}
          </p>
        )}
        {notice && (
          <p role="status" className="text-muted-foreground">
            {notice}
          </p>
        )}
        {state.loading && state.items.length === 0 && (
          <p role="status" className="text-muted-foreground">
            Loading your projects…
          </p>
        )}
        {!state.loading && !state.error && state.items.length === 0 && (
          <Card>
            <CardContent className="space-y-4 py-12 text-center">
              <h2 className="text-xl font-semibold text-ink">Your next discovery starts here</h2>
              <p className="text-muted-foreground">
                Start a project to explore a question and keep the findings together.
              </p>
              <Button asChild>
                <a href="#/">Start your first project</a>
              </Button>
            </CardContent>
          </Card>
        )}
        {state.items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {state.items.length} loaded projects. Status and spend
            describe each project’s latest session.
          </p>
        )}
        {state.items.length > 0 && visible.length === 0 && (
          <p className="text-muted-foreground">No loaded projects match these filters.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={state.loading}>
          {visible.map((card) => (
            <Card key={card.project.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline">{card.project.mode}</Badge>
                  <Badge className={TONE[card.tone]}>{card.label}</Badge>
                </div>
                <CardTitle className="text-base leading-relaxed break-words">
                  {card.project.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Latest session spend</span>
                  <span className="font-mono text-ink">
                    {card.latestSession ? `$${card.latestSession.spend.dollars.toFixed(4)}` : '—'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {card.findingsCount} {card.findingsCount === 1 ? 'finding' : 'findings'} across
                  this project
                </p>
                <p className="text-xs text-faint">
                  Last activity{' '}
                  <time
                    className="font-mono"
                    dateTime={new Date(card.lastActivityAt).toISOString()}
                  >
                    {new Date(card.lastActivityAt).toLocaleString()}
                  </time>
                </p>
                {!card.latestSession && (
                  <p className="text-sm text-muted-foreground">
                    Session creation has not been confirmed. Refresh to check its outcome before
                    starting another project.
                  </p>
                )}
                {card.latestSession && (
                  <p
                    className="truncate font-mono text-xs text-faint"
                    title={card.latestSession.id}
                  >
                    Session {card.latestSession.id}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {card.actions.openSession && card.latestSession && (
                    <Button asChild size="sm">
                      <a href={sessionLink(card.latestSession.id)}>Open session</a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    aria-expanded={selected === card.project.id}
                    onClick={() =>
                      setSelected(selected === card.project.id ? null : card.project.id)
                    }
                  >
                    Findings
                  </Button>
                  {card.actions.stopLatestSession && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={stopping !== null}
                      onClick={() => {
                        void stop(card);
                      }}
                    >
                      {stopping === card.project.id ? 'Requesting…' : 'Stop latest session'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {state.hasMore && (
          <Button variant="outline" disabled={state.loading} onClick={state.loadMore}>
            Load more projects
          </Button>
        )}
        {selectedCard && (
          <Findings
            key={selectedCard.project.id}
            projectId={selectedCard.project.id}
            title={selectedCard.project.title}
            pollAfterMs={selectedCard.pollAfterMs}
          />
        )}
      </div>
    </>
  );
}
