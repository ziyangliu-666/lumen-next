import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';

type Mode = 'forgot' | 'reset' | 'verify';
const MODES: readonly { readonly value: Mode; readonly label: string }[] = [
  { value: 'forgot', label: 'Request password reset' },
  { value: 'reset', label: 'Enter reset code' },
  { value: 'verify', label: 'Verify email' },
];
const isMode = (value: string): value is Mode => MODES.some((mode) => mode.value === value);

/** Codes are pasted from email, never read from URLs or browser storage. */
export function RecoveryPanel(): JSX.Element {
  const [mode, setMode] = useState<Mode>('forgot');
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/mail', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        if (
          !controller.signal.aborted &&
          typeof body === 'object' &&
          body !== null &&
          'enabled' in body
        )
          setEnabled(body.enabled === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  function select(next: Mode): void {
    setMode(next);
    setCode('');
    setPassword('');
    setConfirmation('');
    setMessage('');
    setError('');
  }
  async function send(path: string, payload?: object): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (
        path.endsWith('/reset-password') &&
        (password !== confirmation ||
          [...password].length < 8 ||
          new TextEncoder().encode(password).length > 1024)
      )
        throw new Error(
          'Passwords must match and contain at least 8 characters, at most 1024 UTF-8 bytes.',
        );
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        ...(payload
          ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
          : {}),
      });
      if (!response.ok) {
        if (response.status === 401)
          throw new Error('Sign in before verifying your account email.');
        if (response.status === 429)
          throw new Error('Too many attempts. Wait a minute and try again.');
        if (response.status === 400)
          throw new Error('Invalid or expired code, or invalid input. Request a fresh code.');
        throw new Error('Unable to complete the request. Try again later.');
      }
      setMessage(
        path.endsWith('/reset-password')
          ? 'Password reset. All previous sessions were signed out. Return to sign in with your new password.'
          : path.endsWith('/verify')
            ? 'Email verified.'
            : 'If the account is eligible and delivery is available, a code will be sent. In local outbox mode, check the local mail folder.',
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Request failed');
    } finally {
      busy.current = false;
      setPending(false);
      setCode('');
      setPassword('');
      setConfirmation('');
    }
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (mode === 'forgot') void send('/api/auth/forgot-password', { email });
    else if (mode === 'reset')
      void send('/api/auth/reset-password', { code, newPassword: password });
    else void send('/api/me/email/verify', { code });
  }
  // The three tasks are one choice, so they are tabs: words with a rule under
  // the current one, as in the composer's modes. Radix renders the children of
  // the active panel only, so the shared body below mounts once and its field
  // ids stay unique.
  const panel = (
    <div className="grid gap-4 pt-4">
      {!enabled ? (
        <p className="text-sm text-ink-2">
          Mail actions are unavailable until configured on this server.
        </p>
      ) : null}
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
      {mode === 'verify' ? (
        <div className="grid justify-items-start gap-2">
          <p className="text-sm text-ink-2">
            Sign in first. A verification code is bound to your current account and email.
          </p>
          <Button
            variant="outline"
            disabled={pending || !enabled}
            onClick={() => {
              void send('/api/me/email/verification');
            }}
          >
            Send verification email
          </Button>
        </div>
      ) : null}
      <form onSubmit={submit} className="grid gap-4">
        {mode === 'forgot' ? (
          <div className="grid gap-2">
            <Label htmlFor="recovery-email">Account email</Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="recovery-code">Code from email</Label>
            <Input
              id="recovery-code"
              autoComplete="off"
              required
              minLength={43}
              maxLength={43}
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
              disabled={pending}
            />
          </div>
        )}
        {mode === 'reset' ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="recovery-password">New password</Label>
              <Input
                id="recovery-password"
                type="password"
                autoComplete="new-password"
                required
                maxLength={1024}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recovery-confirm">Confirm new password</Label>
              <Input
                id="recovery-confirm"
                type="password"
                autoComplete="new-password"
                required
                maxLength={1024}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={pending}
              />
            </div>
          </>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending || !enabled}>
          {pending
            ? 'Please wait…'
            : mode === 'forgot'
              ? 'Send reset email'
              : mode === 'reset'
                ? 'Reset password'
                : 'Confirm email verification'}
        </Button>
      </form>
    </div>
  );
  return (
    <section aria-labelledby="recovery-heading" className="grid gap-2">
      <h2 id="recovery-heading" className="sr-only">
        Password recovery and email verification
      </h2>
      <Tabs
        value={mode}
        onValueChange={(next: string) => {
          if (isMode(next)) select(next);
        }}
      >
        <TabsList aria-label="Recovery task" className="flex-wrap gap-x-6 gap-y-2">
          {MODES.map((option) => (
            <TabsTrigger key={option.value} value={option.value} disabled={pending}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {MODES.map((option) => (
          <TabsContent key={option.value} value={option.value}>
            {panel}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
