import { useEffect, useState, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Button } from '@/ui/button';

interface Summary {
  spent: Money;
  cap: Money;
}

export function WalletFigures({ summary }: { summary: Summary }): JSX.Element {
  return (
    <>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-2">Total spent</dt>
        <dd className="font-mono tabular-nums">USD {summary.spent.dollars.toFixed(4)}</dd>
        <dt className="text-ink-2">Account cap</dt>
        <dd className="font-mono tabular-nums">USD {summary.cap.dollars.toFixed(4)}</dd>
      </dl>
      <p className="mt-2 text-caption text-ink-2">
        All-time recorded spend, with no monthly reset. The cap is a spending limit, not a balance.
      </p>
    </>
  );
}

export function AccountWallet({ accountId }: { accountId: string }): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<Summary>(`/api/admin/accounts/${encodeURIComponent(accountId)}/wallet`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setSummary(result);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof RequestFailure && failure.status === 404
              ? 'This account is unavailable. Retained expenses remain in the ledger.'
              : 'Account spending could not be loaded.',
          );
      });
    return () => controller.abort();
  }, [accountId, revision]);
  return (
    <section className="mt-6 border-t border-rule-minor pt-4" aria-label="Account spending">
      <h3 className="mb-3 text-sm font-semibold">Spending</h3>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-4 text-sm">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setSummary(null);
              setRevision((value) => value + 1);
            }}
          >
            Retry spending
          </Button>
        </div>
      ) : summary ? (
        <WalletFigures summary={summary} />
      ) : (
        <p role="status" className="text-sm text-ink-2">
          Loading account spending…
        </p>
      )}
    </section>
  );
}
