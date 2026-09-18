// Owner: LU YI. Account content for the shell-owned Settings composition.
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';

interface Account {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'staff';
}
async function request(path: string, method: string, body?: object): Promise<unknown> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        'Sign in again or check your current password. Provider-only accounts cannot use password reauthentication.',
      );
    if (response.status === 429) throw new Error('Too many attempts. Wait a minute and try again.');
    if (response.status === 409)
      throw new Error(
        'The account changed, the email is taken, or retained resources prevent deletion.',
      );
    throw new Error('The operation failed. Check your input and try again.');
  }
  return response.status === 204 ? null : response.json();
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

/** Shell owner mounts this component and handles shared auth/cache invalidation. */
export function AccountPanel({ onSignedOut }: { readonly onSignedOut: () => void }): JSX.Element {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
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
      setDeleteConfirmation('');
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
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p role="alert" className="rounded-md bg-gap-soft p-3 text-sm text-gap">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-keep">
            {message}
          </p>
        ) : null}
        {!account ? (
          <p className="text-muted-foreground">
            {error ? 'Account unavailable.' : 'Loading account…'}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Role: {account.role}</p>
            <div className="space-y-2">
              <Label htmlFor="account-current-password">
                Current password (required for sensitive changes)
              </Label>
              <Input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={pending}
                maxLength={1024}
              />
            </div>
            <form
              className="space-y-3"
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
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                disabled={pending}
              />
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
              <Button type="submit" disabled={pending}>
                Save profile
              </Button>
            </form>
            <form
              className="space-y-3"
              onSubmit={(event) =>
                submit(event, async () => {
                  if (newPassword !== confirmation) throw new Error('Passwords do not match.');
                  if (
                    [...newPassword].length < 15 ||
                    new TextEncoder().encode(newPassword).length > 1024
                  )
                    throw new Error('Use at least 15 characters and at most 1024 UTF-8 bytes.');
                  await request('/api/me/password', 'POST', { currentPassword, newPassword });
                  setMessage('Password changed. Use sign out everywhere to revoke other sessions.');
                })
              }
            >
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
              <Button type="submit" disabled={pending}>
                Change password
              </Button>
            </form>
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
            <form
              className="space-y-3 border-t border-border pt-4"
              onSubmit={(event) =>
                submit(event, async () => {
                  if (deleteConfirmation !== account.email)
                    throw new Error('Type your exact email to confirm deletion.');
                  await request('/api/me', 'DELETE', { currentPassword });
                  setAccount(null);
                  onSignedOut();
                })
              }
            >
              <p className="text-sm text-muted-foreground">
                Deletion is permanent and requires your password. Accounts with projects or retained
                ledger entries cannot be deleted here. Provider-only deletion requires a future
                reauthentication flow.
              </p>
              <Label htmlFor="account-delete-confirm">Type your email to confirm deletion</Label>
              <Input
                id="account-delete-confirm"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                disabled={pending}
                autoComplete="off"
              />
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || deleteConfirmation !== account.email || !currentPassword}
              >
                Delete account permanently
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
