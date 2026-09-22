import type { JSX } from 'react';
import { Button } from '@/ui/button';

export function ProviderSignIn({
  status,
  providers,
  pending,
  onRefresh,
}: {
  readonly status: 'loading' | 'ready' | 'error';
  readonly providers: { readonly github: boolean; readonly google: boolean };
  readonly pending: boolean;
  readonly onRefresh: () => void;
}): JSX.Element {
  return (
    <section aria-label="Provider sign-in" className="space-y-3">
      <h2 className="text-sm font-medium text-ink">Or use your account</h2>
      {(['github', 'google'] as const).map((provider) => {
        const name = provider === 'github' ? 'GitHub' : 'Google';
        const unavailable = status === 'ready' && !providers[provider];
        return (
          <div key={provider} className="space-y-1">
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
              <p id={`${provider}-availability`} className="text-xs text-muted-foreground">
                {name} is not configured on this server.
              </p>
            ) : null}
          </div>
        );
      })}
      {status === 'loading' ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking sign-in providers…
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="text-sm text-gap">
          Could not check sign-in providers.
        </p>
      ) : null}
      {status === 'error' || (status === 'ready' && (!providers.github || !providers.google)) ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRefresh}>
          Refresh availability
        </Button>
      ) : null}
    </section>
  );
}
