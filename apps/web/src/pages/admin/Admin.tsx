import { useEffect, useState, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { AdminLedger } from './AdminLedger';
import { AccountActions } from './AccountActions';
import { AccountWallet } from './AccountWallet';
import { PageCrumb } from '@/core/shell';
import { cn } from '@/lib/utils';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { ScrollRegion } from '@/ui/scroll-region';
import { RegionName, SurfaceMain, Surfaces, SurfaceWell } from '@/ui/surfaces';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';

interface Account {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'staff';
  suspended: boolean;
  createdAt: number;
}
function message(error: unknown): string {
  if (error instanceof RequestFailure) {
    if (error.status === 401) return 'Please sign in again.';
    if (error.status === 403) return 'Account administration is available to staff only.';
    if (error.status === 404) return 'This account is unavailable. It may have been deleted.';
  }
  return 'Account information could not be loaded. Please retry.';
}

/** A retry helps a failed load, never a refusal: signing in or a staff role does. */
function retryable(error: unknown): boolean {
  return !(error instanceof RequestFailure && (error.status === 401 || error.status === 403));
}

// The state is a word, never a colour: red in Raster means "waits on you",
// and a suspended account does not wait on the person reading this table.
function stateOf(account: Account): string {
  return account.suspended ? 'Suspended' : 'Active';
}

export function Admin(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<{ accounts: Account[] }>('/api/admin/accounts', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setAccounts(result.accounts);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(message(failure));
        setCanRetry(retryable(failure));
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    request<{ account: Account }>(`/api/admin/accounts/${encodeURIComponent(selected)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result.account);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setDetailError(message(failure));
      });
    return () => controller.abort();
  }, [selected, revision]);

  function refresh(): void {
    setAccounts(null);
    setDetail(null);
    setError(null);
    setDetailError(null);
    setRevision((value) => value + 1);
  }
  function select(id: string): void {
    setDetail(null);
    setDetailError(null);
    setSelected(id);
  }
  function close(): void {
    setSelected(null);
    setDetail(null);
    setDetailError(null);
  }
  const loading = accounts === null && error === null;

  // A refusal (not signed in, or not staff) is one fact, so it is said once,
  // across the page, with the way back. Before, the accounts and the ledger
  // each showed it in a box with a Refresh that could not help, and an empty
  // details panel took a third of the screen.
  if (error && !canRetry) {
    return (
      <>
        <PageCrumb page="Admin" />
        <div className="max-w-xl pt-4">
          <Alert
            title="Staff only"
            action={
              <Button asChild variant="outline" size="sm">
                <a href="#/home">Back to Projects</a>
              </Button>
            }
          >
            {error}
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <PageCrumb page="Admin" />
      {/* Paper holds the two tables; the well holds the one account being
          looked at. Below the split width the well is a sheet that View
          opens, so the details never land under a long ledger. */}
      <Surfaces collapse="sheet">
        <SurfaceMain>
          <ScrollRegion as="section" aria-label="Accounts and ledger" className="flex-1">
            <div className="grid gap-10 py-6">
              <section aria-labelledby="admin-accounts" className="min-w-0">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <RegionName
                      id="admin-accounts"
                      {...(accounts ? { count: accounts.length } : {})}
                      className="mb-1"
                    >
                      Accounts
                    </RegionName>
                    <p className="text-caption text-ink-2">
                      Account directory and access management. Staff access only.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled={loading} onClick={refresh}>
                    Refresh
                  </Button>
                </div>
                {error && (
                  <Alert
                    title="The accounts could not be loaded"
                    action={
                      canRetry ? (
                        <Button variant="outline" size="sm" onClick={refresh}>
                          Retry
                        </Button>
                      ) : null
                    }
                  >
                    {error}
                  </Alert>
                )}
                {loading && (
                  <p role="status" className="text-sm text-ink-2">
                    Loading accounts…
                  </p>
                )}
                {accounts &&
                  (accounts.length === 0 ? (
                    <p className="text-sm text-ink-2">No accounts found.</p>
                  ) : (
                    <Table flush>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="hidden roomy:table-cell">Role</TableHead>
                          <TableHead className="hidden roomy:table-cell">State</TableHead>
                          <TableHead>
                            <span className="sr-only">Details</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow
                            key={account.id}
                            data-state={selected === account.id ? 'selected' : undefined}
                          >
                            <TableCell className="max-w-48 break-words whitespace-normal">
                              <p className="font-medium text-ink">{account.displayName}</p>
                              <p className="text-ink-2">{account.email}</p>
                              <p className="mt-1 text-xs text-ink-2 roomy:hidden">
                                <span className="capitalize">{account.role}</span>,{' '}
                                {stateOf(account).toLowerCase()}
                              </p>
                            </TableCell>
                            <TableCell className="hidden capitalize roomy:table-cell">
                              {account.role}
                            </TableCell>
                            <TableCell
                              className={
                                account.suspended
                                  ? 'hidden font-medium text-ink roomy:table-cell'
                                  : 'hidden text-ink-2 roomy:table-cell'
                              }
                            >
                              {stateOf(account)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                aria-label={`View ${account.email}`}
                                aria-pressed={selected === account.id}
                                onClick={() => select(account.id)}
                                disabled={selected === account.id}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ))}
              </section>
              <AdminLedger />
            </div>
          </ScrollRegion>
        </SurfaceMain>
        <SurfaceWell
          aria-label="Account details"
          title="Account details"
          titled={selected !== null}
          open={selected !== null}
          onClose={close}
        >
          <div className={cn('pb-6', selected === null && 'split:pt-6')}>
            {selected ? (
              <>
                {detailError ? (
                  <Alert
                    title="The account could not be loaded"
                    action={
                      <Button variant="outline" size="sm" onClick={refresh}>
                        Retry
                      </Button>
                    }
                  >
                    {detailError}
                  </Alert>
                ) : detail ? (
                  <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm break-words">
                    <dt className="text-ink-2">Name</dt>
                    <dd>{detail.displayName}</dd>
                    <dt className="text-ink-2">Email</dt>
                    <dd>{detail.email}</dd>
                    <dt className="text-ink-2">Account ID</dt>
                    <dd className="font-mono text-xs leading-5 break-all">{detail.id}</dd>
                    <dt className="text-ink-2">Role</dt>
                    <dd className="capitalize">{detail.role}</dd>
                    <dt className="text-ink-2">State</dt>
                    <dd>{stateOf(detail)}</dd>
                    <dt className="text-ink-2">Created</dt>
                    <dd className="font-mono text-xs leading-5 tabular-nums">
                      {new Date(detail.createdAt).toLocaleString()}
                    </dd>
                  </dl>
                ) : (
                  <p role="status" className="text-sm text-ink-2">
                    Loading account…
                  </p>
                )}
                {detail && !detailError && (
                  <>
                    <AccountActions
                      key={`${detail.id}:${detail.role}:${detail.suspended}`}
                      account={detail}
                      onChanged={refresh}
                    />
                    <AccountWallet key={detail.id} accountId={detail.id} />
                  </>
                )}
              </>
            ) : (
              <>
                <RegionName>Account details</RegionName>
                <p className="text-sm text-ink-2">
                  Choose View on an account to see its details, spending and actions.
                </p>
              </>
            )}
          </div>
        </SurfaceWell>
      </Surfaces>
    </>
  );
}
