import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

export interface CurrentAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'user' | 'staff';
  readonly createdAt: number;
}

type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'ready'; readonly account: CurrentAccount }
  | { readonly status: 'error' };

function accountOf(value: unknown): CurrentAccount | null {
  if (typeof value !== 'object' || value === null) return null;
  const account = value as Record<string, unknown>;
  if (
    typeof account.id !== 'string' ||
    typeof account.email !== 'string' ||
    typeof account.displayName !== 'string' ||
    (account.role !== 'user' && account.role !== 'staff') ||
    typeof account.createdAt !== 'number'
  ) {
    return null;
  }
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    createdAt: account.createdAt,
  };
}

function useCurrentAccount(): { readonly state: AuthState; readonly refresh: () => void } {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const refresh = useCallback(() => {
    setState({ status: 'loading' });
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) return { status: 'signed-out' } as const;
        if (!response.ok) return { status: 'error' } as const;
        const account = accountOf(await response.json().catch(() => null));
        return account ? ({ status: 'ready', account } as const) : ({ status: 'error' } as const);
      })
      .then((next) => {
        if (!controller.signal.aborted) setState(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const refreshWhenVisible = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('lumen:auth-changed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('lumen:auth-changed', refresh);
    };
  }, [refresh]);

  return { state, refresh };
}

/** Resolve the server session before rendering any staff-only page content. */
export function StaffGuard({ children }: { readonly children: ReactNode }): JSX.Element {
  const { state, refresh } = useCurrentAccount();

  useEffect(() => {
    if (state.status === 'signed-out') window.location.hash = '/signin';
    if (state.status === 'ready' && state.account.role !== 'staff') window.location.hash = '/home';
  }, [state]);

  if (state.status === 'loading') {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle>Checking access</CardTitle>
          <CardDescription>Confirming your current account and role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to check access</CardTitle>
          <CardDescription>The server could not confirm your current account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refresh}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status !== 'ready' || state.account.role !== 'staff') {
    return <p role="status">Redirecting…</p>;
  }

  return <>{children}</>;
}
