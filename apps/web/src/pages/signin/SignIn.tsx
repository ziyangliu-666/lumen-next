// Owner: LU YI. Page: Sign in / sign up.
import { useRef, useState, type FormEvent, type JSX } from 'react';
import { PageHeader } from '@/core/shell';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';
import { submitAuthentication } from './authClient.js';

export function SignIn(): JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const signup = mode === 'signup';

  function showError(message: string): void {
    setError(message);
    // Focus after React paints the error, without moving focus on initial load.
    requestAnimationFrame(() => feedback.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (signup && password !== confirmation) {
      showError('The passwords do not match.');
      return;
    }
    if (new TextEncoder().encode(password).length > 1024 || (signup && [...password].length < 15)) {
      showError(
        signup
          ? 'Use at least 15 characters and at most 1024 UTF-8 bytes.'
          : 'Password is too long.',
      );
      return;
    }
    if (signup && !displayName.trim()) {
      showError('Enter your name.');
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const principal = await submitAuthentication(
        signup
          ? { mode: 'signup', email: email.trim(), displayName: displayName.trim(), password }
          : { mode: 'signin', email: email.trim(), password },
      );
      // Fixed internal destinations only. Preserve existing question/mode query
      // context, but never copy credentials to a URL or browser storage.
      window.location.hash = principal.role === 'staff' ? '/admin' : '/home';
    } catch (failure) {
      showError(failure instanceof Error ? failure.message : 'Authentication failed.');
    } finally {
      setPassword('');
      setConfirmation('');
      setPending(false);
      submitting.current = false;
    }
  }

  function switchMode(): void {
    if (submitting.current) return;
    setMode(signup ? 'signin' : 'signup');
    setPassword('');
    setConfirmation('');
    setError(null);
  }

  return (
    <>
      <PageHeader
        title={signup ? 'Create an account' : 'Sign in'}
        description="Your research starts here."
      />
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>{signup ? 'Join lumen' : 'Welcome back'}</CardTitle>
          <CardDescription>
            {signup
              ? 'Create an account with your email.'
              : 'Continue with your email and password.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            aria-busy={pending}
            className="space-y-4"
          >
            {signup ? (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Name</Label>
                <Input
                  id="auth-name"
                  name="displayName"
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={displayName}
                  disabled={pending}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={320}
                placeholder="you@example.edu"
                value={email}
                disabled={pending}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                maxLength={1024}
                value={password}
                disabled={pending}
                aria-describedby={signup ? 'password-policy' : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {signup ? (
                <p id="password-policy" className="text-sm text-muted-foreground">
                  At least 15 characters. Spaces and Unicode are welcome.
                </p>
              ) : null}
            </div>
            {signup ? (
              <div className="space-y-2">
                <Label htmlFor="auth-confirmation">Confirm password</Label>
                <Input
                  id="auth-confirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={1024}
                  value={confirmation}
                  disabled={pending}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            ) : null}
            {error ? (
              <p
                ref={feedback}
                tabIndex={-1}
                role="alert"
                className="rounded-md bg-gap-soft p-3 text-sm text-gap"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
            </Button>
            <p role="status" className="sr-only">
              {pending ? 'Submitting your request.' : ''}
            </p>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={switchMode}
            disabled={pending}
          >
            {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Button>
          <Separator />
          <div className="space-y-2" aria-describedby="oauth-status">
            <Button type="button" variant="outline" className="w-full" disabled>
              Continue with GitHub
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled>
              Continue with Google
            </Button>
            <p id="oauth-status" className="text-sm text-muted-foreground">
              GitHub and Google sign-in are not available yet.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
