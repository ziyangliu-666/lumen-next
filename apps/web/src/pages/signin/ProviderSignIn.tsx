import type { JSX } from 'react';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';

export type ProviderStatus = 'loading' | 'ready' | 'error';
export interface Providers {
  readonly github: boolean;
  readonly google: boolean;
}

/** True when the page should offer provider sign-in at all. */
export function offersProviders(status: ProviderStatus, providers: Providers): boolean {
  return status !== 'ready' || providers.github || providers.google;
}

/**
 * Provider choices above the email form. A server with no provider configured
 * shows nothing, rather than advertising buttons that cannot work.
 */
export function ProviderSignIn({
  status,
  providers,
  pending,
  onRefresh,
}: {
  readonly status: ProviderStatus;
  readonly providers: Providers;
  readonly pending: boolean;
  readonly onRefresh: () => void;
}): JSX.Element | null {
  if (!offersProviders(status, providers)) return null;
  return (
    <section aria-label="Provider sign-in" className="grid gap-2">
      {(['google', 'github'] as const).map((provider) => {
        const name = provider === 'github' ? 'GitHub' : 'Google';
        const unavailable = status === 'ready' && !providers[provider];
        return (
          <div key={provider} className="grid gap-1">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending || status !== 'ready' || !providers[provider]}
              aria-describedby={unavailable ? `${provider}-availability` : undefined}
              onClick={() => window.location.assign(`/api/auth/${provider}`)}
            >
              Continue with {name}
            </Button>
            {unavailable ? (
              <p id={`${provider}-availability`} className="text-caption text-ink-2">
                {name} is not configured on this server.
              </p>
            ) : null}
          </div>
        );
      })}
      {status === 'loading' ? (
        <p role="status" className="text-caption text-ink-2">
          Checking sign-in providers…
        </p>
      ) : null}
      {status === 'error' ? (
        <Alert
          title="Could not check sign-in providers."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onRefresh}
            >
              Try again
            </Button>
          }
        >
          Email sign-in below does not depend on this check.
        </Alert>
      ) : null}
    </section>
  );
}
