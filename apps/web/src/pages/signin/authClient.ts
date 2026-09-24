export interface SignedInPrincipal {
  readonly accountId: string;
  readonly role: 'user' | 'staff';
}

export type AuthSubmission =
  | { readonly mode: 'signin'; readonly email: string; readonly password: string }
  | {
      readonly mode: 'signup';
      readonly email: string;
      readonly password: string;
      readonly displayName: string;
    };

/** Page-local transport; successful authentication refreshes shared shell readers. */
export async function submitAuthentication(input: AuthSubmission): Promise<SignedInPrincipal> {
  const path = input.mode === 'signup' ? '/api/auth/signup' : '/api/auth/password';
  const body =
    input.mode === 'signup'
      ? { email: input.email, password: input.password, displayName: input.displayName }
      : { email: input.email, password: input.password };
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Incorrect email or password.');
    if (response.status === 409)
      throw new Error('This email is already registered. Try signing in.');
    if (response.status === 429) throw new Error('Too many attempts. Wait a minute and try again.');
    if (response.status === 404 || response.status === 503) {
      throw new Error('Authentication is not available on this server yet.');
    }
    if (response.status === 403)
      throw new Error('This site is not allowed to submit authentication requests.');
    if (response.status === 400)
      throw new Error('Check your email, name and password requirements.');
    throw new Error(
      input.mode === 'signup'
        ? 'Could not finish registration. If your account was created, try signing in.'
        : 'Could not sign in. Please try again later.',
    );
  }
  const value: unknown = await response.json().catch(() => null);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('accountId' in value) ||
    typeof value.accountId !== 'string' ||
    !value.accountId ||
    !('role' in value) ||
    (value.role !== 'user' && value.role !== 'staff')
  ) {
    throw new Error('The server returned an invalid sign-in response.');
  }
  window.dispatchEvent(new Event('lumen:auth-changed'));
  return { accountId: value.accountId, role: value.role };
}
