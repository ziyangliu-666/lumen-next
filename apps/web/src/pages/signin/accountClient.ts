/** Same-origin account transport; successful mutations invalidate shell auth readers. */
export async function accountRequest(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: object,
): Promise<unknown> {
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
    if (response.status === 409) throw new Error('The account changed or the email is taken.');
    throw new Error('The operation failed. Check your input and try again.');
  }
  const value: unknown = response.status === 204 ? null : await response.json();
  if (method !== 'GET') window.dispatchEvent(new Event('lumen:auth-changed'));
  return value;
}
