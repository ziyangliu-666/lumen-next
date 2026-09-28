// Owner: LU YI. The irreversible part of the Account settings content.
import { useRef, useState, type JSX } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/alert-dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { deleteOwnAccount, RECENT_SIGN_IN_MINUTES } from './accountDeletion';

export interface DeleteAccountViewProps {
  readonly currentPassword: string;
  readonly pending: boolean;
  readonly error: string;
  readonly onPasswordChange: (value: string) => void;
  /** Runs only from the confirmation dialog's destructive action. */
  readonly onConfirm: () => void;
}

/** Stateless so it renders the same in a test as in the page. */
export function DeleteAccountView({
  currentPassword,
  pending,
  error,
  onPasswordChange,
  onConfirm,
}: DeleteAccountViewProps): JSX.Element {
  return (
    <section aria-labelledby="delete-account-heading" className="space-y-3 border-t pt-4">
      <h3 id="delete-account-heading" className="font-medium text-ink">
        Delete account
      </h3>
      <p className="text-sm text-muted-foreground">
        Deletion is immediate and cannot be undone. Your sign-in methods, sessions and personal
        details are removed. Projects, research sessions and billing records are kept under an
        anonymous placeholder.
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-gap-soft p-3 text-sm text-gap">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="delete-account-password">
          Current password (leave empty if you sign in only with GitHub or Google and signed in
          within the last {RECENT_SIGN_IN_MINUTES} minutes)
        </Label>
        <Input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => onPasswordChange(event.target.value)}
          disabled={pending}
          maxLength={1024}
        />
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={pending}>
            {pending ? 'Deleting…' : 'Delete account'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. You are signed out everywhere and cannot sign in to this
              account again. Your email address becomes free to register.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my account</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Account deletion for AccountPanel; onDeleted leaves for the sign-in page. */
export function DeleteAccountSection({
  onDeleted,
}: {
  readonly onDeleted: () => void;
}): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function confirm(): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    const refused = await deleteOwnAccount({ confirmed: true, currentPassword }, onDeleted);
    busy.current = false;
    setPending(false);
    setCurrentPassword('');
    if (refused) setError(refused);
  }
  return (
    <DeleteAccountView
      currentPassword={currentPassword}
      pending={pending}
      error={error}
      onPasswordChange={setCurrentPassword}
      onConfirm={() => {
        void confirm();
      }}
    />
  );
}
