import { useEffect, useState, type FormEvent, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

interface Summary {
  spent: Money;
  cap: Money;
}
interface Entry {
  id: string;
  taskId: string | null;
  amount: Money;
  reason: string;
  createdAt: string;
}
interface Page {
  entries: Entry[];
  nextCursor: string | null;
}
const dollars = (value: Money): string => `$${value.dollars.toFixed(4)}`;
function message(error: unknown): string {
  if (error instanceof RequestFailure && error.status === 401)
    return 'Please sign in to view your wallet.';
  return error instanceof Error ? error.message : 'The wallet could not be loaded. Please retry.';
}

export function Wallet(): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<Summary>('/api/wallet', { signal: controller.signal }),
      request<Page>(
        `/api/wallet/ledger?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        { signal: controller.signal },
      ),
    ])
      .then(([wallet, entries]) => {
        if (controller.signal.aborted) return;
        setSummary(wallet);
        setPage(entries);
        setCap(String(wallet.cap.dollars));
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(message(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);

  function load(next: string | null): void {
    setLoading(true);
    setError(null);
    setCursor(next);
    setRevision((value) => value + 1);
  }
  function refresh(): void {
    load(null);
  }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = cap.trim();
    if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) > 999999.999999) {
      setError('Enter a non-negative dollar amount below 1000000 with at most six decimals.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const wallet = await request<Summary>('/api/wallet/cap', {
        method: 'PATCH',
        json: { cap: { dollars: Number(value) } },
      });
      setSummary(wallet);
      setSaved(true);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4" aria-busy={loading || saving}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Current UTC month. Amounts are in US dollars.
        </p>
        <Button variant="outline" disabled={loading || saving} onClick={refresh}>
          Refresh
        </Button>
      </div>
      {error && (
        <div role="alert" className="rounded-md bg-gap-soft p-4 text-sm text-gap">
          {error} {summary && 'Previously loaded figures are shown.'}
          <Button
            variant="outline"
            className="ml-3"
            disabled={loading || saving}
            onClick={() => load(cursor)}
          >
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading wallet…
        </p>
      )}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spent this month</CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl text-ink">
                {dollars(summary.spent)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly cap</CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl text-ink">
                {dollars(summary.cap)}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Set monthly cap</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  void save(event);
                }}
                className="grid gap-3"
              >
                <Label htmlFor="wallet-cap">Cap in USD</Label>
                <div className="flex gap-3">
                  <Input
                    id="wallet-cap"
                    value={cap}
                    onChange={(event) => {
                      setCap(event.target.value);
                      setSaved(false);
                    }}
                    inputMode="decimal"
                    className="max-w-xs font-mono"
                    disabled={saving || loading}
                    required
                  />
                  <Button type="submit" disabled={saving || loading}>
                    {saving ? 'Saving…' : 'Save cap'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This saves your limit. Automatic budget checks and approval requests arrive in the
                  next sprint. Changing the cap does not add credit or change recorded spend.
                </p>
                {saved && (
                  <p role="status" className="text-sm text-keep">
                    Monthly cap saved.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </>
      )}
      {page && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ledger</CardTitle>
            <p className="text-sm text-muted-foreground">All recorded expenses, newest first.</p>
          </CardHeader>
          <CardContent>
            {page.entries.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No expenses on this page.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-sm break-words">{entry.reason}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.taskId ? (
                          <span title={entry.taskId}>{entry.taskId.slice(0, 8)}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {dollars(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                disabled={!cursor || loading || saving}
                onClick={() => load(null)}
              >
                Newest
              </Button>
              <Button
                variant="outline"
                disabled={!page.nextCursor || loading || saving || !!error}
                onClick={() => load(page.nextCursor)}
              >
                Older
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
