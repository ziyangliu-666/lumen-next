// Account content for the shell-owned Settings composition.
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { accountRequest as request } from './accountClient';
import { Field, Section } from '@/ui/section';
import { DeleteAccountSection } from './DeleteAccountSection';

interface Account {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'staff';
}
function accountOf(value: unknown): Account {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('displayName' in value) ||
    typeof value.displayName !== 'string' ||
    !('role' in value) ||
    (value.role !== 'user' && value.role !== 'staff')
  )
    throw new Error('Invalid account response');
  return { id: value.id, email: value.email, displayName: value.displayName, role: value.role };
}

/** AccountSettings guards access; successful mutations notify shared auth readers. */
export function AccountPanel({ onSignedOut }: { readonly onSignedOut: () => void }): JSX.Element {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void request('/api/me', 'GET')
      .then((value) => {
        if (!active) return;
        const loaded = accountOf(value);
        setAccount(loaded);
        setName(loaded.displayName);
        setEmail(loaded.email);
      })
      .catch(() => {
        if (active) setError('Unable to load account. Sign in and reload this page.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Operation failed');
    } finally {
      busy.current = false;
      setPending(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    }
  }
  function submit(event: FormEvent, action: () => Promise<void>): void {
    event.preventDefault();
    void run(action);
  }
  async function signout(all: boolean): Promise<void> {
    await request(all ? '/api/auth/signout-all' : '/api/auth/signout', 'POST');
    setAccount(null);
    onSignedOut();
  }
  return (
    <div className="grid gap-10">
      {error || message ? (
        <div className="grid gap-2">
          {error ? (
            <p role="alert" className="text-sm font-medium text-ink">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-ink">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
      {!account ? (
        <p className="text-sm text-ink-2">{error ? 'Account unavailable.' : 'Loading account…'}</p>
      ) : (
        <>
          <Section
            title="Current password"
            description="Required for sensitive changes: a new email or a new password."
          >
            <div className="grid max-w-md gap-4">
              <Field>
                <Label htmlFor="account-current-password">Current password</Label>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={pending}
                  maxLength={1024}
                />
              </Field>
            </div>
          </Section>
          <Section title="Profile" description={`Role: ${account.role}`}>
            <form
              className="grid max-w-md gap-4"
              onSubmit={(event) =>
                submit(event, async () => {
                  const changedEmail = email.trim().toLowerCase() !== account.email;
                  const updated = accountOf(
                    await request('/api/me', 'PATCH', {
                      displayName: name,
                      ...(changedEmail ? { email, currentPassword } : {}),
                    }),
                  );
                  setAccount(updated);
                  setName(updated.displayName);
                  setEmail(updated.email);
                  setMessage('Profile updated.');
                })
              }
            >
              <Field>
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={80}
                  disabled={pending}
                />
              </Field>
              <Field>
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={320}
                  disabled={pending}
                />
              </Field>
              <Button type="submit" className="justify-self-start" disabled={pending}>
                Save profile
              </Button>
            </form>
          </Section>
          <Section title="Password">
            <form
              className="grid max-w-md gap-4"
              onSubmit={(event) =>
                submit(event, async () => {
                  if (newPassword !== confirmation) throw new Error('Passwords do not match.');
                  if (
                    [...newPassword].length < 8 ||
                    new TextEncoder().encode(newPassword).length > 1024
                  )
                    throw new Error('Use at least 8 characters and at most 1024 UTF-8 bytes.');
                  await request('/api/me/password', 'POST', { currentPassword, newPassword });
                  setMessage('Password changed. Other sessions have been signed out.');
                })
              }
            >
              <Field>
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  disabled={pending}
                  maxLength={1024}
                />
              </Field>
              <Field>
                <Label htmlFor="account-confirm-password">Confirm new password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  disabled={pending}
                  maxLength={1024}
                />
              </Field>
              <Button type="submit" className="justify-self-start" disabled={pending}>
                Change password
              </Button>
            </form>
          </Section>
          <Section
            title="Sessions"
            description="Sign out everywhere ends the session on every device, this one too."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  void run(() => signout(false));
                }}
              >
                Sign out
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  void run(() => signout(true));
                }}
              >
                Sign out everywhere
              </Button>
            </div>
          </Section>
          <DeleteAccountSection onDeleted={onSignedOut} />
        </>
      )}
    </div>
  );
}
