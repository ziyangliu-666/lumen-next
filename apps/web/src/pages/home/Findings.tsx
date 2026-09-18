import { useCallback, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { sessionLink, type Finding } from './api';
import { usePages } from './usePages';

export function Findings({
  projectId,
  title,
  polling,
}: {
  projectId: string;
  title: string;
  polling: boolean;
}): JSX.Element {
  const shouldPoll = useCallback(() => polling, [polling]);
  const state = usePages<Finding>(
    `/api/projects/${encodeURIComponent(projectId)}/findings`,
    shouldPoll,
  );
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Findings · {title}</CardTitle>
        <Button variant="outline" size="sm" onClick={state.refresh} disabled={state.loading}>
          Refresh findings
        </Button>
      </CardHeader>
      <CardContent className="space-y-4" aria-busy={state.loading}>
        {state.error && (
          <p role="alert" className="text-gap">
            {state.error}
          </p>
        )}
        {state.loading && state.items.length === 0 && (
          <p role="status" className="text-muted-foreground">
            Loading findings…
          </p>
        )}
        {!state.loading && !state.error && state.items.length === 0 && (
          <p className="text-muted-foreground">
            No findings yet. Saved results will appear here as the research progresses.
          </p>
        )}
        {state.items.map((finding) => (
          <article key={finding.id} className="space-y-3 rounded-md border border-border p-4">
            <p className="break-words whitespace-pre-wrap text-body">{finding.text}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <time
                className="font-mono text-xs text-faint"
                dateTime={new Date(finding.createdAt).toISOString()}
              >
                {new Date(finding.createdAt).toLocaleString()}
              </time>
              <Button asChild variant="link" size="sm">
                <a href={sessionLink(finding.sessionId, finding.taskId)}>Open source session</a>
              </Button>
            </div>
          </article>
        ))}
        {state.hasMore && (
          <Button variant="outline" onClick={state.loadMore} disabled={state.loading}>
            More findings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
