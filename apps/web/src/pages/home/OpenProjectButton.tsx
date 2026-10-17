import { useState, type JSX, type MouseEvent, type ReactNode } from 'react';
import { go } from '@/core/router';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { openProject } from './openProject';

/**
 * Records the visit, then opens the session. It is a button and not a link
 * because the visit must land before the page leaves Home. A child marked
 * `data-flight` (the project's title) flies into the session's breadcrumb
 * on the way (core/router `go`).
 * - 'button': a small outline button.
 * - 'plain': the children are the control, for a project title or a finding
 *   that opens where it came from. They underline on hover, as a link does.
 */
export function OpenProjectButton({
  projectId,
  target,
  children,
  variant = 'button',
  className,
}: {
  readonly projectId: string;
  readonly target: string;
  readonly children: ReactNode;
  readonly variant?: 'button' | 'plain';
  readonly className?: string;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open(flight: HTMLElement | null): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await openProject(projectId, target, (url) => go(url, flight));
    } catch {
      setError(
        'Could not record your visit. Try opening again, or sign in if your session expired.',
      );
    } finally {
      setPending(false);
    }
  }
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    void open(event.currentTarget.querySelector<HTMLElement>('[data-flight]'));
  };
  return (
    <div className={cn('min-w-0', className)}>
      {variant === 'plain' ? (
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={onClick}
          // The plain button stretches its hit area over the whole row (the
          // nearest positioned parent), so the row opens wherever it is
          // clicked; only the title text was a target before, and it was
          // hard to hit.
          className="group block w-full min-w-0 text-left after:absolute after:inset-0 after:content-[''] disabled:opacity-50"
        >
          {children}
        </button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
          {pending ? 'Opening…' : children}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-1 text-caption text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
