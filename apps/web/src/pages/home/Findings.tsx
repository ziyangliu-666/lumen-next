import { useCallback, type JSX } from 'react';
import { cn } from '@/lib/utils';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { RegionName } from '@/ui/surfaces';
import { sessionLink, type Finding } from './api';
import { ago, useNow } from './ago';
import { usePages } from './usePages';
import { OpenProjectButton } from './OpenProjectButton';

// The findings of one project, on the well under the new-project form. The
// well is where the session page keeps findings too, so the surface that
// means "what lumen produced" says the same on both pages.
//
// A finding carries no verdict on the wire yet, so the list shows the claim,
// where it came from and when. The verdict mark joins it once the contract
// has one; inventing "Open question" for every finding would be a false claim.
export function Findings({
  projectId,
  pollAfterMs,
}: {
  projectId: string;
  pollAfterMs: number | null;
}): JSX.Element {
  const shouldPoll = useCallback(() => pollAfterMs, [pollAfterMs]);
  const state = usePages<Finding>(
    `/api/projects/${encodeURIComponent(projectId)}/findings`,
    shouldPoll,
  );
  const now = useNow();
  return (
    <section aria-labelledby="latest-findings-name" className="pt-8 pb-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <RegionName id="latest-findings-name" className="mb-0">
            Latest findings
          </RegionName>
        </div>
        {/* The same secondary button as every other refresh: as grey text
            it did not read as something to press. */}
        <Button variant="outline" size="sm" onClick={state.refresh} disabled={state.loading}>
          {state.error ? 'Retry' : 'Refresh findings'}
        </Button>
      </div>
      <div aria-busy={state.loading}>
        {state.error && (
          <Alert title="The findings could not be loaded" className="mb-3">
            {state.error} {state.paused && 'Automatic retries paused. Choose Retry to try again.'}
          </Alert>
        )}
        {state.loading && state.items.length === 0 && (
          <p role="status" className="text-sm text-ink-2">
            Loading findings…
          </p>
        )}
        {!state.loading && !state.error && state.items.length === 0 && (
          <p className="text-sm text-ink-2">No findings yet.</p>
        )}
        {state.items.length > 0 && (
          <ul>
            {/* Three, two lines each: a column of long findings read as a
                wall of text. The session shows them all. */}
            {state.items.slice(0, 3).map((finding) => (
              <li
                key={finding.id}
                // The same 8px inset and hover as the findings on the session
                // page, so one list looks the same on both pages.
                // Relative: the button's stretched layer covers this row only.
                // Without it the layer covered the whole panel, and a click
                // anywhere there, the new-project field included, opened the
                // last finding's session.
                className="relative border-t border-rule-minor px-2 py-3 first:border-t-0 hover:bg-raised/50"
              >
                <OpenProjectButton
                  variant="plain"
                  projectId={projectId}
                  target={sessionLink(finding.sessionId, finding.taskId)}
                >
                  <span className="sr-only">Open the source session of: </span>
                  {/* A name in one bold line, then the fact in two quiet
                      ones, as a list of chats is a name and a line: the
                      whole fact in two lines was a wall of numbers. A
                      finding kept before names shows its text alone. */}
                  {finding.title ? (
                    <span className="line-clamp-1 text-sm font-semibold break-words text-ink">
                      {finding.title}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'line-clamp-2 text-sm break-words',
                      finding.title ? 'mt-0.5 text-ink-2' : 'text-ink',
                    )}
                  >
                    {finding.text}
                  </span>
                  <span className="mt-1 block text-caption text-ink-2">
                    Recorded{' '}
                    <time
                      dateTime={new Date(finding.createdAt).toISOString()}
                      title={new Date(finding.createdAt).toLocaleString()}
                    >
                      {ago(finding.createdAt, now)}
                    </time>
                  </span>
                </OpenProjectButton>
              </li>
            ))}
          </ul>
        )}
        {state.hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={state.loadMore}
            disabled={state.loading}
          >
            More findings
          </Button>
        )}
      </div>
    </section>
  );
}
