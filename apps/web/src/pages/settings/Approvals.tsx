import { useEffect, useState, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { RunState } from '@/ui/run-state';
import { Section } from '@/ui/section';

interface Approval {
  id: string;
  taskId: string;
  checkpoint: string;
  estimate: { dollars: number };
  unknownCost: boolean;
  reason: string;
  status: 'pending' | 'consumed' | 'rejected';
  resumePending: boolean;
}
function message(error: unknown): string {
  if (error instanceof RequestFailure && error.status === 401) return 'Please sign in again.';
  if (error instanceof RequestFailure && error.status === 403)
    return 'This account cannot approve spending.';
  if (error instanceof RequestFailure && (error.status === 404 || error.status === 503))
    return 'Budget approvals are not available on this server.';
  return 'Approvals could not be updated. Refresh to check the saved decision before trying again.';
}
/** The wallet remounts it (a new key) when its one Refresh is pressed. */
export function Approvals(): JSX.Element {
  const [rows, setRows] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<{ approvals: Approval[] }>('/api/wallet/approvals', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setRows(result.approvals);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(message(failure));
      });
    return () => controller.abort();
  }, [revision]);
  function refresh(): void {
    setRows(null);
    setError(null);
    setRevision((value) => value + 1);
  }
  async function decide(id: string, action: 'grant' | 'reject'): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await request(`/api/wallet/approvals/${encodeURIComponent(id)}/${action}`, { json: {} });
      refresh();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section
      title="Budget approvals"
      description="Each approval lets one blocked step run. It does not raise the cap."
    >
      {error && <Alert title="Approvals">{error}</Alert>}
      {!rows && !error && (
        <p role="status" className="text-sm text-ink-2">
          Loading approvals…
        </p>
      )}
      {rows?.length === 0 && <p className="text-sm text-ink-2">No approval requests.</p>}
      {rows && rows.length > 0 && (
        // Ruled rows, not boxes. A pending request is the one thing on this
        // page that waits on the reader, so it alone carries the red dot.
        <ul className="border-t border-rule-minor">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-2 border-b border-rule-minor py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-medium text-ink">{row.reason}</p>
                {row.status === 'pending' ? (
                  <RunState state="waiting">Waiting on your approval</RunState>
                ) : row.status === 'rejected' ? (
                  <RunState state="stopped">Rejected</RunState>
                ) : (
                  <RunState state="finished">Approved</RunState>
                )}
              </div>
              <p className="flex flex-wrap gap-x-4 text-sm text-ink-2">
                <span>{row.checkpoint}</span>
                <span>
                  Task <span className="font-mono">{row.taskId.slice(0, 8)}</span>
                </span>
              </p>
              <p className="text-sm">
                {row.unknownCost ? (
                  'One execution of unknown cost.'
                ) : (
                  <>
                    Estimated cost{' '}
                    <span className="font-mono tabular-nums">
                      ${row.estimate.dollars.toFixed(6)}
                    </span>{' '}
                    USD.
                  </>
                )}
              </p>
              {row.status === 'pending' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void decide(row.id, 'grant');
                    }}
                  >
                    Approve once
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void decide(row.id, 'reject');
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <p role="status" className="text-sm text-ink-2">
                  {row.status === 'rejected'
                    ? row.resumePending
                      ? 'Rejected. Stopping the task…'
                      : 'Rejected. The task stopped.'
                    : row.resumePending
                      ? 'Approved. Resuming…'
                      : 'Approved. The task went on.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
