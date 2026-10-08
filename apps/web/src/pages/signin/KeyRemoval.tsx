import { useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { beginKeyRemoval, removeKeyWithPassword } from './keyRemovalClient';

export function KeyRemoval({
  providers,
  onBack,
}: {
  providers: { github: boolean; google: boolean };
  onBack: () => void;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function remove(provider?: 'github' | 'google'): Promise<void> {
    if (busy.current) return;
    if (!provider && new TextEncoder().encode(password).length > 1024) {
      setPassword('');
      setError('Password is too long.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    setMessage('');
    const submitted = password;
    setPassword('');
    try {
      if (provider) window.location.assign(await beginKeyRemoval(provider));
      else {
        await removeKeyWithPassword(email, submitted);
        setMessage('Removal completed. Your account and sign-in status have not changed.');
      }
    } catch {
      setError('Removal could not be confirmed. Check your sign-in method and try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    void remove();
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Remove your OpenAI key</h1>
      <p className="text-sm text-muted-foreground">
        This deletes only your saved key. It does not sign you in, delete your account or restore a
        suspended account. Confirm using your account’s existing sign-in method. Calls already sent
        are not cancelled.
      </p>
      {message ? (
        <p role="status" className="text-sm text-keep">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-gap">
          {error}
        </p>
      ) : null}
      <form onSubmit={submit} className="grid gap-3" aria-busy={pending}>
        <Label htmlFor="removal-email">Account email</Label>
        <Input
          id="removal-email"
          type="email"
          autoComplete="username"
          required
          maxLength={320}
          disabled={pending}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Label htmlFor="removal-password">Current password</Label>
        <Input
          id="removal-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          disabled={pending}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button variant="destructive" type="submit" disabled={pending}>
          Confirm removal with password
        </Button>
      </form>
      {(['github', 'google'] as const)
        .filter((provider) => providers[provider])
        .map((provider) => (
          <Button
            key={provider}
            variant="outline"
            disabled={pending}
            onClick={() => {
              void remove(provider);
            }}
          >
            Confirm removal with {provider === 'github' ? 'GitHub' : 'Google'}
          </Button>
        ))}
      <Button variant="ghost" disabled={pending} onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}
