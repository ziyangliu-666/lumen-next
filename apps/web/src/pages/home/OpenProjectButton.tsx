import { useState, type JSX, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import { openProject } from './openProject';

export function OpenProjectButton({
  projectId,
  target,
  children,
}: {
  readonly projectId: string;
  readonly target: string;
  readonly children: ReactNode;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await openProject(projectId, target, (url) => window.location.assign(url));
    } catch {
      setError(
        'Could not record your visit. Try opening again, or sign in if your session expired.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          void open();
        }}
      >
        {pending ? 'Opening…' : children}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-gap">
          {error}
        </p>
      )}
    </div>
  );
}
