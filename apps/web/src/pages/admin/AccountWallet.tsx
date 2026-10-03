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
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Total spent</dt>
        <dd className="font-mono">USD {summary.spent.dollars.toFixed(4)}</dd>
        <dt className="text-muted-foreground">Account cap</dt>
        <dd className="font-mono">USD {summary.cap.dollars.toFixed(4)}</dd>
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">
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
    <section className="mt-4 border-t border-border pt-4" aria-label="Account spending">
      {error ? (
        <div role="alert" className="text-sm text-gap">
          {error}{' '}
          <Button
            variant="outline"
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
        <p role="status" className="text-sm text-muted-foreground">
          Loading account spending…
        </p>
      )}
    </section>
  );
}
