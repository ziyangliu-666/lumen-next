// Owner: LU YI. Mount through the shell composition, never from another page.
import { useState, type JSX } from 'react';
import { useCurrentAccount } from '@/core/auth';
import { Button } from '@/ui/button';
import { AccountPanel } from './AccountPanel';
import { Section } from '@/ui/section';

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
  // The tab is already called Account, so the section names what it holds.
  return (
    <div aria-busy={state.status === 'loading'}>
      <Section
        title={
          state.status === 'ready' && state.mode === 'stub' ? 'Development account' : 'Your account'
        }
      >
        <div className="grid justify-items-start gap-4 text-sm">
          {state.status === 'loading' ? (
            <p role="status" className="text-ink-2">
              Checking your account…
            </p>
          ) : state.status === 'error' ? (
            <>
              <p role="alert" className="font-medium text-ink">
                Unable to check your account.
              </p>
              <Button onClick={refresh}>Try again</Button>
            </>
          ) : state.mode === 'stub' ? (
            <>
              {state.status === 'ready' ? (
                <p className="text-ink">
                  You use the development account{' '}
                  <span className="font-semibold">{state.account.displayName}</span>. It has no
                  password and no email.
                </p>
              ) : null}
              <p className="max-w-prose text-ink-2">
                This server has no account database, so there is no name, email, password or
                deletion to manage here. To change the account, sign out from the account menu at
                the top right and choose another name.
              </p>
            </>
          ) : (
            <>
              <p className="text-ink">Sign in to manage your account.</p>
              <Button asChild>
                <a href="#/signin">Sign in</a>
              </Button>
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
