// Owner: LU YI. The shell injects these actions; it owns layout and navigation.
import { Fragment, useRef, useState, type JSX } from 'react';
import { signOutStub } from '@/core/api';
import { useCurrentAccount, type AuthState } from '@/core/auth';
import { avatarClassName, initialsOf } from '@/ui/avatar';
import { Button } from '@/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { accountRequest } from './accountClient';

// The account at the end of the bar is the one way to the pages that are not
// in a breadcrumb: the projects, settings, admin, and sign out. The first
// port showed the development account as grey text that did nothing, so
// two reviewers reached Settings only by typing its address, and found no
// way to sign out at all.

type Ready = Extract<AuthState, { status: 'ready' }>;

/** One entry of the account menu. `signout` says which way out it takes. */
export type AccountEntry =
  | { readonly kind: 'link'; readonly label: string; readonly href: string }
  | { readonly kind: 'signout'; readonly label: string; readonly session: boolean };

/**
 * What the menu offers an account. A development account has no server
 * session, so its sign-out only drops the cookie and never calls the real
 * signout route.
 */
export function accountEntries(state: Ready): readonly AccountEntry[] {
  return [
    { kind: 'link', label: 'Projects', href: '#/home' },
    { kind: 'link', label: 'Settings', href: '#/settings' },
    ...(state.account.role === 'staff'
      ? [{ kind: 'link' as const, label: 'Admin', href: '#/admin' }]
      : []),
    { kind: 'signout', label: 'Sign out', session: state.mode === 'identity' },
  ];
}

export function AccountActions(): JSX.Element {
  const { state, refresh } = useCurrentAccount();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function signout(session: boolean): Promise<void> {
    if (!session) {
      signOutStub();
      window.location.assign('#/');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await accountRequest('/api/auth/signout', 'POST');
      window.location.assign('#/signin');
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
      <Button size="sm" variant="link" onClick={refresh}>
        Retry account check
      </Button>
    );
  }
  if (state.status === 'signed-out') {
    // A quiet text link: the bar's one outlined shape is the avatar, and a
    // boxed control here would compete with the page's primary button.
    // Sign up beside it, filled, as products with accounts show the two. A
    // development server has no accounts to create, so it shows Sign in only.
    return (
      <span className="flex items-center gap-4">
        <Button asChild size="sm" variant="link">
          <a href="#/signin">Sign in</a>
        </Button>
        {state.mode === 'stub' ? null : (
          <Button asChild size="sm">
            <a href="?mode=signup#/signin">Sign up</a>
          </Button>
        )}
      </span>
    );
  }
  const name = state.account.displayName;
  const development = state.mode === 'stub';
  return (
    <div role="group" aria-label="Account controls" className="flex items-center gap-4">
      {error ? (
        <p role="alert" className="text-sm font-medium text-ink">
          {error}
        </p>
      ) : null}
      <DropdownMenu>
        {/* The account is the outlined circle at the end of the bar, as in
            the prototype. The name is in the menu and the accessible name,
            not beside the circle: the circle already carries the initials. */}
        <DropdownMenuTrigger
          aria-label={`Account menu: ${name}`}
          className="group inline-flex items-center gap-2 text-sm font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          disabled={pending}
        >
          <span aria-hidden="true" className={avatarClassName}>
            {initialsOf(name)}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="grid gap-0.5">
            <span className="truncate">{name}</span>
            <span className="text-caption font-normal text-ink-2">
              {development ? 'Development account' : 'Signed in'}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accountEntries(state).map((entry) =>
            entry.kind === 'link' ? (
              <DropdownMenuItem key={entry.href} asChild>
                <a href={entry.href} className="hover:no-underline">
                  {entry.label}
                </a>
              </DropdownMenuItem>
            ) : (
              <Fragment key="signout">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => {
                    void signout(entry.session);
                  }}
                >
                  {pending ? 'Signing out…' : entry.label}
                </DropdownMenuItem>
              </Fragment>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
