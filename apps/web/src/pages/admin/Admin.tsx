// Owner: HE RONG. Page: Admin.
import { useEffect, useState, type JSX } from 'react';
import { PageHeader } from '@/core/shell';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import {
  AdminRequestFailure,
  getAdminAccount,
  listAdminAccounts,
  type AdminAccount,
} from './adminClient.js';

type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'error'; readonly message: string };

function dateOf(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(timestamp),
  );
}

function messageOf(error: unknown): string {
  if (error instanceof AdminRequestFailure) {
    if (error.status === 401 || error.status === 403) {
      window.dispatchEvent(new Event('lumen:auth-changed'));
    }
    return error.message;
  }
  return 'Unable to load administrator data. Try again.';
}

function AccountDetails({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}): JSX.Element {
  const [state, setState] = useState<LoadState<AdminAccount>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void getAdminAccount(accountId, controller.signal).then(
      (account) => setState({ status: 'ready', value: account }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: messageOf(error) });
      },
    );
    return () => controller.abort();
  }, [accountId]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Account details</CardTitle>
          <CardDescription>Read-only identity information.</CardDescription>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent aria-live="polite">
        {state.status === 'loading' ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : state.status === 'error' ? (
          <p role="alert" className="rounded-md bg-gap-soft p-3 text-sm text-gap">
            {state.message}
          </p>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-ink">{state.value.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{state.value.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account ID</dt>
              <dd className="font-mono break-all">{state.value.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{dateOf(state.value.createdAt)}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function Admin(): JSX.Element {
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState<AdminAccount[]>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void listAdminAccounts(controller.signal).then(
      (accounts) => setState({ status: 'ready', value: accounts }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: messageOf(error) });
      },
    );
    return () => controller.abort();
  }, [revision]);

  function refresh(): void {
    setSelectedId(null);
    setState({ status: 'loading' });
    setRevision((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Review registered accounts and their current access state."
        actions={
          <Button variant="outline" onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {state.status === 'loading' ? (
        <Card aria-busy="true">
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </CardContent>
        </Card>
      ) : state.status === 'error' ? (
        <Card>
          <CardHeader>
            <CardTitle>Accounts unavailable</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refresh}>Try again</Button>
          </CardContent>
        </Card>
      ) : state.value.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No accounts</CardTitle>
            <CardDescription>No registered accounts were returned by the server.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-3xl">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.value.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.displayName}</TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          account.suspended ? 'bg-gap-soft text-gap' : 'bg-keep-soft text-keep'
                        }
                      >
                        {account.suspended ? 'Suspended' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>{dateOf(account.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" onClick={() => setSelectedId(account.id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedId ? (
        <AccountDetails
          key={selectedId}
          accountId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
