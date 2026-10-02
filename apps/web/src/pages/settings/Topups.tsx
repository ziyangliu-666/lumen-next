import { useEffect, useRef, useState, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';

interface TopupData {
  enabled: boolean;
  receipts: readonly { id: string; amount: Money; paidAt: string }[];
}

export function Topups({ onRefresh }: { onRefresh: () => void }): JSX.Element {
  const [data, setData] = useState<TopupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestId = useRef<string | null>(null);
  const query = new URLSearchParams(window.location.search);
  const returned = query.get('topup');
  const confirmed = data?.receipts.some((receipt) => receipt.id === query.get('order'));
  useEffect(() => {
    const controller = new AbortController();
    request<TopupData>('/api/wallet/topups', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Could not load top-ups.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  async function buy(): Promise<void> {
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const checkout = await request<{ url: string }>('/api/wallet/topups/checkout', {
        json: { offer: 'usd5', requestId: requestId.current },
      });
      const url = new URL(checkout.url);
      if (url.origin !== 'https://checkout.stripe.com')
        throw new Error('Invalid checkout destination.');
      window.location.assign(url.href);
    } catch (failure) {
      if (failure instanceof RequestFailure && failure.status === 409) requestId.current = null;
      setError(
        failure instanceof Error ? failure.message : 'Could not open checkout. Please retry.',
      );
      setBusy(false);
    }
  }
  function refresh(): void {
    setLoading(true);
    setError(null);
    setRevision((value) => value + 1);
    onRefresh();
  }
  return (
    <Card aria-busy={loading || busy}>
      <CardHeader>
        <CardTitle className="text-base">Test-mode top-ups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Add USD 5 to your spending cap using Stripe test mode. No real money is charged. Top-ups
          do not reduce recorded spend or automatically resume a waiting task. No refunds; remaining
          credit is forfeited when the account is deleted.
        </p>
        {returned === 'returned' && confirmed && (
          <p role="status" className="text-keep">
            Your USD 5 test top-up is confirmed. The spending cap has been updated.
          </p>
        )}
        {returned === 'returned' && !confirmed && (
          <p role="status">
            Back from Stripe. This payment is waiting for its confirmed receipt. Refresh to check
            for confirmation and the updated cap.
          </p>
        )}
        {returned === 'cancelled' && (
          <p role="status">Checkout was cancelled. Returning here does not add credit.</p>
        )}
        {error && (
          <p role="alert" className="text-gap">
            {error}
          </p>
        )}
        {loading && <p role="status">Loading top-ups…</p>}
        {data && !data.enabled && <p>Test top-ups are not enabled on this server.</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!data?.enabled || loading || busy}
            onClick={() => {
              void buy();
            }}
          >
            {busy ? 'Opening Stripe…' : 'Add USD 5 in test mode'}
          </Button>
          <Button variant="outline" disabled={loading || busy} onClick={refresh}>
            Refresh top-ups and cap
          </Button>
        </div>
        {data?.receipts.length === 0 && (
          <p className="text-muted-foreground">No confirmed top-ups yet.</p>
        )}
        {!!data?.receipts.length && (
          <div className="space-y-2">
            <p className="font-medium">Confirmed top-ups (latest 100)</p>
            {data.receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-2"
              >
                <span>{new Date(receipt.paidAt).toLocaleString()}</span>
                <span className="font-mono">USD {receipt.amount.dollars.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
