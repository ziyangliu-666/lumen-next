import { accountRequest, AccountRequestError } from './accountClient';

type Send = typeof accountRequest;

/** How long after signing in an account without a password may still delete itself. */
export const RECENT_SIGN_IN_MINUTES = 10;

function refusal(failure: unknown): string {
  if (failure instanceof AccountRequestError) {
    if (failure.status === 401)
      return `Deletion refused. Enter your current password. If you sign in only with GitHub or Google, leave it empty, sign out, sign in again, and delete within ${RECENT_SIGN_IN_MINUTES} minutes.`;
    if (failure.status === 409) return 'Your account changed. Sign in again and retry.';
    return failure.message;
  }
  return 'Could not reach the server. Your account was not deleted.';
}

/**
 * Deletes the signed-in account. Nothing is sent until the person confirmed the
 * irreversible step. Once the account is gone it calls onDeleted, which leaves
 * for sign-in, and resolves to null; otherwise it resolves to the message to
 * show, and the account is untouched.
 */
export async function deleteOwnAccount(
  input: { readonly confirmed: boolean; readonly currentPassword: string },
  onDeleted: () => void,
  send: Send = accountRequest,
): Promise<string | null> {
  if (!input.confirmed) return 'Confirm that you want to delete your account.';
  try {
    // An account without a password proves a recent sign-in instead; its
    // session cookie travels with the request.
    await send(
      '/api/me',
      'DELETE',
      input.currentPassword ? { currentPassword: input.currentPassword } : {},
    );
  } catch (failure) {
    return refusal(failure);
  }
  onDeleted();
  return null;
}
