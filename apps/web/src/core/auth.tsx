import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import { Section } from '@/ui/section';
import { Skeleton } from '@/ui/skeleton';
import { request, RequestFailure, stubAccount } from './api';
import { authStateOf, type AuthState } from './authState';

export { authStateOf, type AuthState, type CurrentAccount } from './authState';

/**
 * Ask the server who is using this tab. A non-2xx answer carries its status in
 * a RequestFailure, and authStateOf decides what that status means: 404 is a
 * process with no identity slice, which is development without a database.
 * Only a failure with no status (the network, an abort) is an error here.
 */
export async function readCurrentAccount(signal?: AbortSignal): Promise<AuthState> {
  try {
    const body = await request<unknown>('/api/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    return authStateOf(200, body, stubAccount());
  } catch (failure) {
    if (failure instanceof RequestFailure) return authStateOf(failure.status, null, stubAccount());
    return { status: 'error' };
  }
}

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
    void readCurrentAccount(controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next);
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
    if (state.status === 'loading' || state.status === 'error' || state.mode === 'stub') return;
    if (state.status === 'signed-out') window.location.hash = '/signin';
    else if (state.account.role !== 'staff') window.location.hash = '/home';
  }, [state]);

  return (
    <StaffGate state={state} refresh={refresh}>
      {children}
    </StaffGate>
  );
}

/**
 * What the guard shows for an answer, apart from the redirect. Split from
 * StaffGuard so that it renders without a DOM, and is tested that way.
 */
export function StaffGate({
  state,
  refresh,
  children,
}: {
  readonly state: AuthState;
  readonly refresh: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  // Plain ruled sections, not cards: Raster has no boxes around content.
  if (state.status === 'loading') {
    return (
      <Section title="Checking access" description="Confirming your current account and role." busy>
        <div className="grid max-w-md gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </Section>
    );
  }

  if (state.status === 'error') {
    return (
      <Section
        title="Unable to check access"
        description="The server could not confirm your current account."
      >
        <Button className="justify-self-start" onClick={refresh}>
          Try again
        </Button>
      </Section>
    );
  }

  // A process with no database has no /api/me and no roles to check. It is
  // development only (main.ts refuses it in production), so the page renders,
  // signed in with the development cookie or not; the staff routes behind it
  // still answer 401 or 403 to the stub principal on their own.
  if (state.mode === 'stub') return <>{children}</>;

  if (state.status !== 'ready' || state.account.role !== 'staff') {
    return <p role="status">Redirecting…</p>;
  }

  return <>{children}</>;
}

// Where to go once signed in. A session link opened signed out sends the
// person to sign in; every way of signing in (password, Google, GitHub)
// lands on the projects, so the projects page goes on to the session. Kept
// in sessionStorage: it belongs to this tab and this one sign-in.
const RETURN_KEY = 'lumen:after-sign-in';

export function rememberReturn(url: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, url);
  } catch {
    // Storage off: the person lands on their projects instead.
  }
}

/** The remembered address, once: reading it forgets it. */
export function takeReturn(): string | null {
  try {
    const url = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return url;
  } catch {
    return null;
  }
}
