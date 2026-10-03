import { useEffect, useState, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Task</TableHead>
          <TableHead className="text-right">USD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="max-w-48 break-words whitespace-normal">
              <p className="font-medium">{entry.accountLabel}</p>
              <p className="font-mono text-xs break-all text-muted-foreground">{entry.accountId}</p>
            </TableCell>
            <TableCell className="font-mono text-xs whitespace-nowrap">
              {new Date(entry.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {entry.taskId ? <span title={entry.taskId}>{entry.taskId.slice(0, 8)}</span> : '—'}
            </TableCell>
            <TableCell className="text-right font-mono">
              ${entry.amount.dollars.toFixed(4)}
            </TableCell>
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
  const [error, setError] = useState(false);
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
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);
  function load(next: string | null): void {
    setPage(null);
    setError(false);
    setLoading(true);
    setCursor(next);
    setRevision((value) => value + 1);
  }
  return (
    <Card className="min-w-0" aria-busy={loading}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Ledger</CardTitle>
          <Button variant="outline" disabled={loading} onClick={() => load(null)}>
            Refresh ledger
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Recorded expenses, newest first. Deleted accounts retain their ledger history.
        </p>
      </CardHeader>
      <CardContent>
        {loading && (
          <p role="status" className="text-muted-foreground">
            Loading ledger…
          </p>
        )}
        {error && (
          <div role="alert" className="text-gap">
            Ledger could not be loaded.{' '}
            <Button variant="outline" onClick={() => load(cursor)}>
              Retry ledger
            </Button>
          </div>
        )}
        {page &&
          (page.entries.length ? (
            <LedgerRows entries={page.entries} />
          ) : (
            <p className="text-muted-foreground">No expenses on this page.</p>
          ))}
        <div className="mt-4 flex gap-3">
          <Button variant="outline" disabled={loading || !cursor} onClick={() => load(null)}>
            Newest
          </Button>
          <Button
            variant="outline"
            disabled={loading || !page?.nextCursor}
            onClick={() => load(page!.nextCursor)}
          >
            Older
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
