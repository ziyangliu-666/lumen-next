import { useRef, useState, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { useCurrentAccount } from '@/core/auth';
import { Button } from '@/ui/button';

interface Account {
  id: string;
  email: string;
  role: 'user' | 'staff';
  suspended: boolean;
}
export function AccountActions({
  account,
  onChanged,
}: {
  account: Account;
  onChanged: () => void;
}): JSX.Element {
  const { state } = useCurrentAccount();
  const [action, setAction] = useState<'role' | 'suspension' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const role = account.role === 'staff' ? 'user' : 'staff';
  const label =
    action === 'role'
      ? `Change role to ${role}`
      : account.suspended
        ? 'Restore account'
        : 'Suspend account';
  async function save(): Promise<void> {
    if (!action || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await request(`/api/admin/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        json: action === 'role' ? { role } : { suspended: !account.suspended },
        cache: 'no-store',
      });
      setAction(null);
      onChanged();
    } catch (failure) {
      setError(
        failure instanceof RequestFailure && failure.status === 403
          ? 'Your permissions changed, or this action is not allowed. Refresh before retrying.'
          : failure instanceof RequestFailure && failure.status === 404
            ? 'This account is no longer available.'
            : 'The change could not be confirmed. Refresh before retrying.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (state.status !== 'ready' || state.mode !== 'identity' || state.account.role !== 'staff')
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Real staff sign-in is required to change accounts.
      </p>
    );
  if (state.account.id === account.id)
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        You cannot change your own role or suspension here. Ask another administrator.
      </p>
    );
  return (
    <div className="mt-4 grid gap-3 border-t pt-4" aria-busy={pending}>
      <h3 className="font-medium">Manage account</h3>
      {error ? (
        <p role="alert" className="text-sm text-gap">
          {error}
        </p>
      ) : null}
      {action ? (
        <div className="grid gap-3 rounded-md border p-3">
          <p className="text-sm break-words">
            {label} for <strong>{account.email}</strong>?
          </p>
          <p className="text-sm text-muted-foreground">
            {action === 'role'
              ? role === 'staff'
                ? 'Staff can view account records and change other accounts. Grant this only to trusted administrators.'
                : 'Staff access ends on subsequent authenticated requests. Existing connections are not forcibly closed.'
              : account.suspended
                ? 'The user must sign in again. Old sessions and recovery links are not restored.'
                : 'All login sessions and pending recovery proofs are revoked. New sign-ins and new budget-checked work are blocked. Work already running and open connections are not forcibly stopped.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                void save();
              }}
            >
              {pending ? 'Saving…' : 'Confirm change'}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setError('');
              setAction('role');
            }}
          >
            Change role to {role}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setError('');
              setAction('suspension');
            }}
          >
            {account.suspended ? 'Restore account' : 'Suspend account'}
          </Button>
        </div>
      )}
    </div>
  );
}
