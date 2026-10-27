import { formatMoney } from '@/core/formatMoney';
import { useEffect, useState, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { RegionName } from '@/ui/surfaces';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

interface LedgerPage {
  entries: {
    id: string;
    accountId: string;
    accountLabel: string;
    taskId: string | null;
    amount: Money;
    createdAt: string;
  }[];
  nextCursor: string | null;
}

export function LedgerRows({ entries }: Pick<LedgerPage, 'entries'>): JSX.Element {
  return (
    <Table flush>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="hidden roomy:table-cell">Task</TableHead>
          <TableHead className="text-right">USD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="max-w-48 min-w-32 break-words whitespace-normal">
              <p className="font-medium text-ink">{entry.accountLabel}</p>
              <p className="font-mono text-xs break-all text-ink-2">{entry.accountId}</p>
            </TableCell>
            <TableCell className="font-mono text-xs whitespace-normal roomy:whitespace-nowrap">
              {new Date(entry.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className="hidden font-mono text-xs roomy:table-cell">
              {entry.taskId ? (
                <span title={entry.taskId}>{entry.taskId.slice(0, 8)}</span>
              ) : (
                <span className="font-sans text-ink-3">No task</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">${formatMoney(entry.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AdminLedger(): JSX.Element {
  const [page, setPage] = useState<LedgerPage | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // 'refused' is a 401 or 403: a retry cannot help, so none is offered.
  const [error, setError] = useState<'failed' | 'refused' | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    request<LedgerPage>(
      `/api/admin/ledger?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          failure instanceof RequestFailure && (failure.status === 401 || failure.status === 403)
            ? 'refused'
            : 'failed',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);
  function load(next: string | null): void {
    setPage(null);
    setError(null);
    setLoading(true);
    setCursor(next);
    setRevision((value) => value + 1);
  }
  return (
    <section className="min-w-0" aria-labelledby="admin-ledger" aria-busy={loading}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <RegionName id="admin-ledger" className="mb-1">
            Ledger
          </RegionName>
          <p className="text-caption text-ink-2">
            Recorded expenses, newest first. Deleted accounts retain their ledger history.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => load(null)}>
          Refresh
        </Button>
      </div>
      {loading && (
        <p role="status" className="text-sm text-ink-2">
          Loading ledger…
        </p>
      )}
      {error && (
        <Alert
          title="The ledger could not be loaded"
          action={
            error === 'failed' ? (
              <Button variant="outline" size="sm" onClick={() => load(cursor)}>
                Retry
              </Button>
            ) : null
          }
        >
          {error === 'refused' ? 'The ledger is available to staff only.' : null}
        </Alert>
      )}
      {page &&
        (page.entries.length ? (
          <LedgerRows entries={page.entries} />
        ) : (
          <p className="text-sm text-ink-2">No expenses on this page.</p>
        ))}
      {/* Paging only once there is a page to move from: disabled Newest and
          Older under a failed load were two dead controls. */}
      {page && (page.entries.length > 0 || cursor) ? (
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !cursor}
            onClick={() => load(null)}
          >
            Newest
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !page?.nextCursor}
            onClick={() => load(page.nextCursor)}
          >
            Older
          </Button>
        </div>
      ) : null}
    </section>
  );
}
