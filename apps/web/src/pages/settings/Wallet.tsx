import { formatMoney } from '@/core/formatMoney';
import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { Topups } from './Topups';
import { Approvals } from './Approvals';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Section } from '@/ui/section';

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
const dollars = (value: Money): string => `$${formatMoney(value)}`;
/**
 * What a failed wallet request means to the reader, in a sentence. The
 * server's own words ("wallet requires a database") are for logs; shown raw
 * they read as a fault in the page.
 */
function message(error: unknown): string {
  if (error instanceof RequestFailure && error.status === 401)
    return 'Please sign in to view your wallet.';
  if (unavailable(error))
    return 'This server has no billing database, so it keeps no account spend, cap or ledger, and nothing is charged. The amount on a project or a session is what that run recorded for itself.';
  return 'The wallet could not be loaded. Please retry.';
}

/** 404 or 503: the server has no wallet at all, so a retry cannot help. */
function unavailable(error: unknown): boolean {
  return error instanceof RequestFailure && (error.status === 404 || error.status === 503);
}

export function Wallet(): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  // How many times the tab's one Refresh was pressed. The top-ups and the
  // approvals load again on it, not on a turn of the ledger's pages.
  const [refreshes, setRefreshes] = useState(0);
  const [cap, setCap] = useState('');
  const [saved, setSaved] = useState(false);
  const [capError, setCapError] = useState<string | null>(null);

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
        if (controller.signal.aborted) return;
        setError(message(failure));
        setRetryable(!unavailable(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);

  function load(next: string | null): void {
    setLoading(true);
    setSaved(false);
    setCapError(null);
    setError(null);
    setCursor(next);
    setRevision((value) => value + 1);
  }
  function refresh(): void {
    load(null);
    setRefreshes((value) => value + 1);
  }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaved(false);
    setCapError(null);
    const value = cap.trim();
    if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) > 999999.999999) {
      setCapError('Enter a non-negative dollar amount below 1000000 with at most six decimals.');
      return;
    }
    setSaving(true);
    try {
      const wallet = await request<Summary>('/api/wallet/cap', {
        method: 'PATCH',
        json: { cap: { dollars: Number(value) } },
      });
      setSummary(wallet);
      setSaved(true);
    } catch (failure) {
      setCapError(
        failure instanceof RequestFailure && failure.status === 401
          ? 'Please sign in again to save your cap.'
          : 'The cap change could not be confirmed. Refresh to check the saved cap before retrying.',
      );
    } finally {
      setSaving(false);
    }
  }

  // No wallet on this server at all: the figures and the Refresh would only
  // say "Not available" twice over the alert that says why, so the card
  // keeps the alert alone.
  const off = summary === null && error !== null && !retryable;

  // Paper on the first seven columns, the well on the last five. The two
  // figures a reader comes here for (spent, cap) and the refresh that reloads
  // them sit in the well beside the forms that change them. Below the split
  // width the well comes first, so they are still the first thing read.
  return (
    <div
      className="grid gap-y-10 split:grid-cols-12 split:gap-x-gutter"
      aria-busy={loading || saving}
    >
      <aside
        aria-labelledby="wallet-spend"
        className="grid content-start gap-6 self-start bg-well p-6 split:sticky split:top-0 split:col-span-5 split:col-start-8 split:row-start-1"
      >
        {/* One refresh for the whole tab, at the head of the card that
            holds the figures. It reloads the figures, the top-ups and the
            approvals; there were four refresh controls on this screen. */}
        <div className="flex items-start justify-between gap-4">
          <h2 id="wallet-spend" className="text-lg font-semibold text-ink">
            Spend
          </h2>
          {off ? null : (
            <Button variant="outline" size="sm" disabled={loading || saving} onClick={refresh}>
              Refresh
            </Button>
          )}
        </div>
        {off ? null : (
          <dl className="grid gap-6">
            <div className="grid gap-1">
              <dt className="text-sm text-ink-2">Total spent</dt>
              <dd className="font-mono text-2xl text-ink tabular-nums">
                {summary ? (
                  dollars(summary.spent)
                ) : (
                  <span className="font-sans text-base text-ink-3">Not available</span>
                )}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-ink-2">Account cap</dt>
              <dd className="font-mono text-2xl text-ink tabular-nums">
                {summary ? (
                  dollars(summary.cap)
                ) : (
                  <span className="font-sans text-base text-ink-3">Not available</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        {off ? null : <p className="text-sm text-ink-2">All-time, in US dollars.</p>}
        {/* The error belongs to the figures it explains, so it is in their
            card, and the card reads the same at every width. */}
        {error && (
          <Alert
            title="The wallet is not available"
            className="bg-paper"
            action={
              retryable ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || saving}
                  onClick={() => load(cursor)}
                >
                  Retry
                </Button>
              ) : null
            }
          >
            {error} {summary && 'Previously loaded figures are shown.'}
          </Alert>
        )}
      </aside>
      <div className="grid min-w-0 content-start gap-10 split:col-span-7 split:row-start-1">
        {loading && (
          <p role="status" className="text-sm text-ink-2">
            Loading wallet…
          </p>
        )}
        {summary && (
          <Section title="Set account cap">
            <form
              onSubmit={(event) => {
                void save(event);
              }}
              className="grid gap-2"
            >
              <Label htmlFor="wallet-cap">Cap in USD</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="wallet-cap"
                  value={cap}
                  onChange={(event) => {
                    setCap(event.target.value);
                    setSaved(false);
                    setCapError(null);
                  }}
                  aria-invalid={capError ? true : undefined}
                  aria-describedby={capError ? 'wallet-cap-error' : undefined}
                  inputMode="decimal"
                  className="max-w-xs font-mono tabular-nums"
                  disabled={saving || loading}
                  required
                />
                <Button type="submit" disabled={saving || loading}>
                  {saving ? 'Saving…' : 'Save cap'}
                </Button>
              </div>
              <p className="max-w-prose text-sm text-ink-2">
                New work past the cap waits for your approval below. Work already running can go
                past it.
              </p>
              {capError && (
                <p id="wallet-cap-error" role="alert" className="text-sm text-ink">
                  {capError}
                </p>
              )}
              {saved && (
                <p role="status" className="text-sm text-ink">
                  Account cap saved.
                </p>
              )}
            </form>
          </Section>
        )}
        <Topups key={`topups-${refreshes}`} />
        <Approvals key={`approvals-${refreshes}`} />
        {page && (
          <Section title="Ledger">
            {page.entries.length === 0 ? (
              <p className="text-sm text-ink-2">No expenses on this page.</p>
            ) : (
              <Table flush>
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
                      <TableCell className="max-w-sm break-words whitespace-normal">
                        {entry.reason}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.taskId ? (
                          <span title={entry.taskId}>{entry.taskId.slice(0, 8)}</span>
                        ) : (
                          <span className="font-sans text-ink-3">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {dollars(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex gap-2">
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
          </Section>
        )}
      </div>
    </div>
  );
}
