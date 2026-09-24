// Owner: LU YI. Mount through the shell composition, never from another page.
import { useState, type JSX } from 'react';
import { useCurrentAccount } from '@/core/auth';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { AccountPanel } from './AccountPanel';

/** Account content slot for Settings; the shell owns the surrounding page. */
export function AccountSettings({
  onSignedOut,
}: {
  readonly onSignedOut?: () => void;
}): JSX.Element {
  const { state, refresh } = useCurrentAccount();
  const [lastAccountId, setLastAccountId] = useState<string | null>(null);
  const resolvedAccountId =
    state.status === 'ready' && state.mode === 'identity' ? state.account.id : null;
  // Adjust retained render state only when a settled account result changes.
  if (state.status !== 'loading' && lastAccountId !== resolvedAccountId) {
    setLastAccountId(resolvedAccountId);
  }
  const accountId =
    state.status === 'ready' && state.mode === 'identity'
      ? state.account.id
      : state.status === 'loading'
        ? lastAccountId
        : null;
  if (accountId) {
    // Keep success feedback and form state during revalidation, but disable
    // controls until the server confirms access. A different account remounts.
    return (
      <fieldset disabled={state.status === 'loading'} aria-busy={state.status === 'loading'}>
        <legend className="sr-only">Account settings</legend>
        <AccountPanel
          key={accountId}
          onSignedOut={() => {
            window.location.hash = '/signin';
            onSignedOut?.();
          }}
        />
      </fieldset>
    );
  }
  return (
    <Card aria-busy={state.status === 'loading'}>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === 'loading' ? (
          <p role="status">Checking your account…</p>
        ) : state.status === 'error' ? (
          <>
            <p role="alert">Unable to check your account.</p>
            <Button onClick={refresh}>Try again</Button>
          </>
        ) : state.mode === 'stub' ? (
          <p>Account management requires database-backed authentication.</p>
        ) : (
          <>
            <p>Sign in to manage your account.</p>
            <Button asChild>
              <a href="#/signin">Sign in</a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
