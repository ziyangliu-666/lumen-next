/** A refused account request; `status` lets a panel word its own message. */
export class AccountRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AccountRequestError';
  }
}

function failureMessage(status: number): string {
  if (status === 401)
    return 'Sign in again or check your current password. Provider-only accounts cannot use password reauthentication.';
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (status === 409) return 'The account changed or the email is taken.';
  return 'The operation failed. Check your input and try again.';
}

/** Same-origin account transport; successful mutations invalidate shell auth readers. */
export async function accountRequest(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  if (!response.ok) throw new AccountRequestError(response.status, failureMessage(response.status));
  const value: unknown = response.status === 204 ? null : await response.json();
  if (method !== 'GET') window.dispatchEvent(new Event('lumen:auth-changed'));
  return value;
}
