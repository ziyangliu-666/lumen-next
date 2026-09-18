import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';

/** Codes are pasted from email, never read from URLs or browser storage. */
export function RecoveryPanel(): JSX.Element {
  const [mode, setMode] = useState<'forgot' | 'reset' | 'verify'>('forgot');
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
  function select(next: 'forgot' | 'reset' | 'verify'): void {
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password recovery and email verification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => select('forgot')}>
            Request password reset
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => select('reset')}>
            Enter reset code
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => select('verify')}>
            Verify email
          </Button>
        </div>
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            Mail actions are unavailable until configured on this server.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-gap">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-keep">
            {message}
          </p>
        ) : null}
        {mode === 'verify' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
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
        <form onSubmit={submit} className="space-y-3">
          {mode === 'forgot' ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
          )}
          {mode === 'reset' ? (
            <>
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
            </>
          ) : null}
          <Button type="submit" disabled={pending || !enabled}>
            {pending
              ? 'Please wait…'
              : mode === 'forgot'
                ? 'Send reset email'
                : mode === 'reset'
                  ? 'Reset password'
                  : 'Confirm email verification'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
