import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { stubAccount } from './api';
import { authStateOf, type AuthState } from './authState';

export { authStateOf, type AuthState, type CurrentAccount } from './authState';

/** The current account, asked of the server once per mount and again on `refresh`. */
export function useCurrentAccount(): {
  readonly state: AuthState;
  readonly refresh: () => void;
} {
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
      .then(async (response) =>
        authStateOf(response.status, await response.json().catch(() => null), stubAccount()),
      )
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
    if (state.status === 'ready' && state.mode === 'identity' && state.account.role !== 'staff') {
      window.location.hash = '/home';
    }
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

  // A process with no database has no roles to check. It is development only
  // (main.ts refuses it in production), so the page renders and says nothing.
  if (state.status === 'ready' && state.mode === 'stub') return <>{children}</>;

  if (state.status !== 'ready' || state.account.role !== 'staff') {
    return <p role="status">Redirecting…</p>;
  }

  return <>{children}</>;
}
