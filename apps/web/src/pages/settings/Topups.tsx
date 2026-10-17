import { useEffect, useRef, useState, type JSX } from 'react';
import type { Money } from '@lumen/contracts';
import { request, RequestFailure } from '@/core/api';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { Section } from '@/ui/section';

interface TopupData {
  enabled: boolean;
  receipts: readonly { id: string; amount: Money; paidAt: string }[];
}

/** The wallet remounts it (a new key) when its one Refresh is pressed. */
export function Topups(): JSX.Element {
  const [data, setData] = useState<TopupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          setError(
            failure instanceof RequestFailure && (failure.status === 404 || failure.status === 503)
              ? 'Top-ups are not available on this server.'
              : 'Could not load top-ups. Refresh to try again.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

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
  return (
    <Section
      title="Test-mode top-ups"
      busy={loading || busy}
      description="Adds USD 5 to your cap in Stripe test mode; no real money is charged. No refunds."
    >
      <div className="grid gap-4 text-sm">
        {returned === 'returned' && confirmed && (
          <p role="status" className="text-ink">
            USD 5 added to your cap.
          </p>
        )}
        {returned === 'returned' && !confirmed && (
          <p role="status">Waiting for Stripe to confirm the payment. Refresh to check.</p>
        )}
        {returned === 'cancelled' && <p role="status">Checkout cancelled. Nothing was added.</p>}
        {error && <Alert title="Top-ups">{error}</Alert>}
        {loading && (
          <p role="status" className="text-ink-2">
            Loading top-ups…
          </p>
        )}
        {data && !data.enabled && (
          <p role="status" className="text-ink-2">
            Top-ups are off on this server.
          </p>
        )}
        {data?.enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || busy}
              onClick={() => {
                void buy();
              }}
            >
              {busy ? 'Opening Stripe…' : 'Add USD 5 in test mode'}
            </Button>
          </div>
        ) : null}
        {data?.receipts.length === 0 && <p className="text-ink-2">No confirmed top-ups yet.</p>}
        {!!data?.receipts.length && (
          <div className="grid gap-2">
            <h3 className="font-semibold text-ink">Confirmed top-ups (latest 100)</h3>
            <Table flush>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {new Date(receipt.paidAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {receipt.amount.dollars.toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Section>
  );
}
