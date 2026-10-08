// Owner: HE RONG. Page: Admin.
import { useEffect, useState, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { AdminLedger } from './AdminLedger';
import { AccountActions } from './AccountActions';
import { AccountWallet } from './AccountWallet';
import { PageHeader } from '@/core/shell';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
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

export function Admin(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<{ accounts: Account[] }>('/api/admin/accounts', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setAccounts(result.accounts);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(message(failure));
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
  const loading = accounts === null && error === null;

  return (
    <>
      <PageHeader
        title="Admin"
        description="Account directory and access management. Staff access only."
        actions={
          <Button variant="outline" disabled={loading} onClick={refresh}>
            Refresh
          </Button>
        }
      />
      <div className="grid min-w-0 gap-4">
        {error && (
          <div role="alert" className="rounded-md bg-gap-soft p-4 text-gap">
            {error}{' '}
            <Button variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}
        {loading && (
          <p role="status" className="text-muted-foreground">
            Loading accounts…
          </p>
        )}
        {accounts && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-muted-foreground">No accounts found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden sm:table-cell">Role</TableHead>
                      <TableHead className="hidden sm:table-cell">State</TableHead>
                      <TableHead>
                        <span className="sr-only">Details</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="max-w-48 break-words whitespace-normal">
                          <p className="font-medium text-ink">{account.displayName}</p>
                          <p className="text-sm text-muted-foreground">{account.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                            {account.role} · {account.suspended ? 'Suspended' : 'Active'}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{account.role}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">
                            {account.suspended ? 'Suspended' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
              )}
            </CardContent>
          </Card>
        )}
        {selected && (
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Account details</CardTitle>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setDetail(null);
                    setDetailError(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detailError ? (
                <div role="alert" className="text-gap">
                  {detailError}{' '}
                  <Button variant="outline" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              ) : detail ? (
                <dl className="grid gap-2 text-sm break-words sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{detail.displayName}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{detail.email}</dd>
                  <dt className="text-muted-foreground">Account ID</dt>
                  <dd className="font-mono break-all">{detail.id}</dd>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{detail.role}</dd>
                  <dt className="text-muted-foreground">State</dt>
                  <dd>{detail.suspended ? 'Suspended' : 'Active'}</dd>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-mono">{new Date(detail.createdAt).toLocaleString()}</dd>
                </dl>
              ) : (
                <p role="status" className="text-muted-foreground">
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
            </CardContent>
          </Card>
        )}
        <AdminLedger />
      </div>
    </>
  );
}
