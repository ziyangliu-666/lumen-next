// Owner: LU YI. The shell injects these actions; it owns layout and navigation.
import { useRef, useState, type JSX } from 'react';
import { useCurrentAccount } from '@/core/auth';
import { Button } from '@/ui/button';
import { accountRequest } from './accountClient';

export function AccountActions(): JSX.Element {
  const { state, refresh } = useCurrentAccount();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function signout(): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await accountRequest('/api/auth/signout', 'POST');
      window.location.hash = '/signin';
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (state.status === 'loading')
    return (
      <span role="status" className="sr-only">
        Checking account…
      </span>
    );
  if (state.status === 'error') {
    return (
      <Button size="sm" variant="outline" onClick={refresh}>
        Retry account check
      </Button>
    );
  }
  if (state.status === 'signed-out') {
    return (
      <Button asChild size="sm" variant="outline">
        <a href="#/signin">Sign in</a>
      </Button>
    );
  }
  if (state.mode === 'stub') {
    return <span className="text-sm text-muted-foreground">Development account</span>;
  }
  return (
    <div role="group" aria-label="Account controls" className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="ghost">
        <a href="#/settings/account">Account</a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          void signout();
        }}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-sm text-gap">
          {error}
        </p>
      ) : null}
    </div>
  );
}
