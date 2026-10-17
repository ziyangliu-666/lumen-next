import { useId, useState, type JSX } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { signInStub } from './api';

// The way in on a server with no account database (development only: the
// server refuses that mode in production). It is shared by the landing and
// the sign-in page. Before, it lived on the landing only, so a visitor who
// went to "Sign in" found an email form that could not work and no other way
// in. It writes the development cookie, and signInStub tells every reader of
// the account, the bar included, so the bar changes at once.

export function DevelopmentSignIn({
  onSignedIn,
  className,
}: {
  /** Called after the cookie is written, for example to go to the projects. */
  readonly onSignedIn?: () => void;
  readonly className?: string;
}): JSX.Element {
  const id = useId();
  const [name, setName] = useState('');
  return (
    <form
      className={cn('grid max-w-md gap-2', className)}
      onSubmit={(event) => {
        event.preventDefault();
        const account = name.trim();
        if (!account) return;
        signInStub(account);
        onSignedIn?.();
      }}
    >
      <Label htmlFor={id}>Development account name</Label>
      <div className="flex flex-col gap-2 roomy:flex-row">
        <Input
          id={id}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Any name, for example ada"
          autoComplete="off"
          required
        />
        {/* Filled: on the sign-in page this is the one action, and the
            front page's Start is filled too, so the way in reads the same
            on both pages. */}
        <Button type="submit">Continue</Button>
      </div>
      <p className="text-caption text-ink-2">
        No password: anyone who types this name sees its projects.
      </p>
    </form>
  );
}
