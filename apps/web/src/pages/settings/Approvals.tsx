import { useEffect, useState, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
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
  return 'Approvals could not be updated. Refresh to check the saved decision before trying again.';
}
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Budget approvals</CardTitle>
          <Button variant="outline" disabled={busy} onClick={refresh}>
            Refresh approvals
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Approve one blocked operation beyond your cap. This does not raise your cap or add credit.
          A fan-out approval includes the children it opens.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <p role="alert" className="text-sm text-gap">
            {error}
          </p>
        )}
        {!rows && !error && <p role="status">Loading approvals…</p>}
        {rows?.length === 0 && (
          <p className="text-sm text-muted-foreground">No approval requests.</p>
        )}
        {rows?.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-md border border-border p-4">
            <p className="font-medium text-ink">{row.reason}</p>
            <p className="text-sm text-muted-foreground">
              {row.checkpoint} · Task <span className="font-mono">{row.taskId.slice(0, 8)}</span>
            </p>
            <p className="text-sm">
              {row.unknownCost
                ? 'One execution of unknown cost.'
                : `Estimated cost: $${row.estimate.dollars.toFixed(6)} USD.`}
            </p>
            {row.status === 'pending' ? (
              <div className="flex flex-wrap gap-2">
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
              <p role="status" className="text-sm text-muted-foreground">
                {row.status === 'rejected' ? 'Rejected.' : 'Approved for this operation.'}{' '}
                {row.resumePending
                  ? 'Applying decision. Refresh to check progress.'
                  : 'Decision delivered. View the session for its outcome.'}
              </p>
            )}
          </div>
        ))}
        {rows && rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Up to 100 requests, pending first. Refresh to load new requests or delivery updates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
