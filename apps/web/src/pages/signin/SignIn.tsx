// Owner: LU YI. Page: Sign in / sign up.
import { useEffect, useRef, useState, type FormEvent, type JSX, type ReactNode } from 'react';
import { useCurrentAccount } from '@/core/auth';
import { DevelopmentSignIn } from '@/core/devSignIn';
import { PageHeader } from '@/core/shell';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';
import { submitAuthentication } from './authClient.js';
import { KeyRemoval } from './KeyRemoval';
import { RecoveryPanel } from './RecoveryPanel.js';
import { offersProviders, ProviderSignIn, type ProviderStatus } from './ProviderSignIn.js';

/**
 * The narrow form column every sign-in view shares. It sits flush left on the
 * 12-column grid, as Raster does everywhere, rather than centred in a card: the
 * left edge is where the reader's eye already is after the bar's wordmark.
 */
function FormColumn({ children }: { readonly children: ReactNode }): JSX.Element {
  // The shell's scene stands behind the form, in its quiet shot: the
  // camera pulls back from the landing's sphere, so the way in is the same
  // scene as the front page instead of a form alone on a blank screen.
  return (
    // Over the split width the form stands on the screen's centre line;
    // top-aligned, it hung from the bar with the screen empty under it.
    <div className="grid gap-x-gutter roomy:grid-cols-12 split:flex-1 split:[align-content:safe_center]">
      <div data-quiet="" className="grid content-start gap-6 roomy:col-span-6 split:col-span-4">
        {children}
      </div>
    </div>
  );
}

/**
 * A server with no account database (development) has no email or provider
 * sign-in: every route behind those forms answers 404. Before, the page still
 * drew them, and a visitor learnt it only after filling in all four fields.
 * Here it says so first and offers the development account, the one way in
 * that works on such a server.
 */
function DevelopmentServer(): JSX.Element {
  const { state } = useCurrentAccount();
  return (
    <FormColumn>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Sign in to lumen</h1>
        <p className="text-sm text-ink-2">Your research starts here.</p>
      </div>
      <Alert role="status" title="Accounts are not available on this server">
        This is a development server without an account database, so email, Google and GitHub
        sign-in are off. Use a development account to try lumen.
      </Alert>
      {state.status === 'ready' ? (
        <p className="text-sm text-ink">
          You use the development account {state.account.displayName}.{' '}
          <a href="#/home" className="font-medium underline underline-offset-[0.15em]">
            Go to your projects
          </a>
        </p>
      ) : (
        <DevelopmentSignIn
          onSignedIn={() => {
            window.location.hash = '/home';
          }}
        />
      )}
    </FormColumn>
  );
}

export function SignIn(): JSX.Element {
  const { state } = useCurrentAccount();
  if (state.status !== 'loading' && state.status !== 'error' && state.mode === 'stub')
    return <DevelopmentServer />;
  return <AccountSignIn />;
}

function AccountSignIn(): JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showKeyRemoval, setShowKeyRemoval] = useState(false);
  const [keyRemovalResult] = useState(() =>
    new URLSearchParams(window.location.search).get('keyRemoval'),
  );
  const [showRecovery, setShowRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('authError');
    return code === 'oauth_email_conflict'
      ? 'This email already belongs to an account. Sign in using its existing method. Automatic account linking is disabled.'
      : code === 'oauth_failed'
        ? 'Provider sign-in failed or expired. Please try again.'
        : null;
  });
  const [providers, setProviders] = useState({ github: false, google: false });
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('loading');
  const [mailEnabled, setMailEnabled] = useState(false);
  useEffect(() => {
    // Recovery is offered only when the server can actually deliver a code.
    const controller = new AbortController();
    void fetch('/api/auth/mail', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        if (!controller.signal.aborted && typeof body === 'object' && body !== null)
          setMailEnabled('enabled' in body && body.enabled === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const [providerRevision, setProviderRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/providers', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Provider lookup failed');
        const value: unknown = await response.json();
        if (
          typeof value !== 'object' ||
          value === null ||
          !('github' in value) ||
          typeof value.github !== 'boolean' ||
          !('google' in value) ||
          typeof value.google !== 'boolean'
        )
          throw new Error('Invalid provider response');
        if (!controller.signal.aborted) {
          setProviders({ github: value.github, google: value.google });
          setProviderStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setProviderStatus('error');
      });
    return () => controller.abort();
  }, [providerRevision]);
  const submitting = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
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
    if (new TextEncoder().encode(password).length > 1024 || (signup && [...password].length < 8)) {
      showError(
        signup
          ? 'Use at least 8 characters and at most 1024 UTF-8 bytes.'
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

  if (showKeyRemoval)
    return (
      <FormColumn>
        <KeyRemoval providers={providers} onBack={() => setShowKeyRemoval(false)} />
      </FormColumn>
    );

  if (showRecovery)
    return (
      <FormColumn>
        {/* The column gap is the only space above the tabs, so the header
            drops its own bottom margin. */}
        <PageHeader
          title="Reset your password"
          description="Use the one-time code from your email."
          className="mb-0"
        />
        <RecoveryPanel />
        <Button
          variant="link"
          className="justify-self-start"
          onClick={() => setShowRecovery(false)}
        >
          Back to sign in
        </Button>
      </FormColumn>
    );

  const showProviders = offersProviders(providerStatus, providers);
  return (
    <FormColumn>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
          {signup ? 'Create your lumen account' : 'Sign in to lumen'}
        </h1>
        <p className="text-sm text-ink-2">Your research starts here.</p>
      </div>
      {keyRemovalResult === 'complete' ? (
        <p role="status" className="text-sm text-ink">
          Key removal completed. You have not been signed in.
        </p>
      ) : keyRemovalResult === 'failed' ? (
        <p role="alert" className="text-sm text-ink">
          Key removal failed or expired. Start a new removal attempt.
        </p>
      ) : null}
      <div className="grid gap-4">
        <ProviderSignIn
          status={providerStatus}
          providers={providers}
          pending={pending}
          onRefresh={() => {
            setProviderStatus('loading');
            setProviderRevision((value) => value + 1);
          }}
        />
        {showProviders ? (
          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-ink-2">or use email</span>
            <Separator className="flex-1" />
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          aria-busy={pending}
          className="grid gap-3"
        >
          {signup ? (
            <div className="grid gap-2">
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
          <div className="grid gap-2">
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
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="auth-password">Password</Label>
              {!signup && mailEnabled ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-xs font-medium"
                  disabled={pending}
                  onClick={() => {
                    setPassword('');
                    setShowRecovery(true);
                  }}
                >
                  Forgot password?
                </Button>
              ) : null}
            </div>
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
              <p id="password-policy" className="text-caption text-ink-2">
                At least 8 characters. Spaces and Unicode are welcome.
              </p>
            ) : null}
          </div>
          {signup ? (
            <div className="grid gap-2">
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
            <Alert
              ref={feedback}
              tabIndex={-1}
              title={signup ? 'The account was not created' : 'You are not signed in'}
            >
              {error}
            </Alert>
          ) : null}
          <Button type="submit" className="mt-1 w-full" disabled={pending}>
            {pending ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </Button>
          <p role="status" className="sr-only">
            {pending ? 'Submitting your request.' : ''}
          </p>
        </form>
      </div>
      <p className="text-sm text-ink-2">
        {signup ? 'Already have an account?' : 'New to lumen?'}{' '}
        <Button
          type="button"
          variant="link"
          className="underline"
          onClick={switchMode}
          disabled={pending}
        >
          {signup ? 'Sign in' : 'Create an account'}
        </Button>
      </p>
      {/* For a person who wants a saved key gone without opening the
          account. It is rare, so it sits last and small. */}
      {!signup ? (
        <Button
          variant="link"
          className="justify-self-start text-caption font-normal text-ink-2 hover:text-ink"
          disabled={pending}
          onClick={() => {
            setPassword('');
            setConfirmation('');
            setShowKeyRemoval(true);
          }}
        >
          Remove a saved OpenAI key without signing in
        </Button>
      ) : null}
    </FormColumn>
  );
}
