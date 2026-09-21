// The part of auth that is a plain function: no React, no DOM, so that it is
// tested with everything else by `npm run verify`. auth.tsx is the hook and the
// guard around it.

export interface CurrentAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'user' | 'staff';
  readonly createdAt: number;
}

// Who is using this tab. Every page asks here and nowhere else. A page that
// works it out for itself (from a cookie it happens to know about) is right
// until the way in changes, and then it is wrong in a way no server test sees:
// the Landing page once read the development cookie, and told a visitor who had
// really signed in to sign in.
//
// `mode` says which way in this server has. 'identity' is real sign-in. 'stub'
// is a process with no database: it has no /api/me, and takes the development
// account from the lumen_stub cookie, as the server does.
export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out'; readonly mode: 'identity' | 'stub' }
  | {
      readonly status: 'ready';
      readonly mode: 'identity' | 'stub';
      readonly account: CurrentAccount;
    }
  | { readonly status: 'error' };

/**
 * What the answer of GET /api/me means. 401 is signed out. 404 is a server with
 * no identity slice at all, which only happens without a database, so the
 * development account decides. Anything else that is not an account is an error.
 */
export function authStateOf(
  status: number,
  body: unknown,
  developmentAccount: string | null,
): AuthState {
  if (status === 401) return { status: 'signed-out', mode: 'identity' };
  if (status === 404) {
    if (!developmentAccount) return { status: 'signed-out', mode: 'stub' };
    return {
      status: 'ready',
      mode: 'stub',
      account: {
        id: developmentAccount,
        email: '',
        displayName: developmentAccount,
        // The stub cookie the page writes is always a plain user.
        role: 'user',
        createdAt: 0,
      },
    };
  }
  if (status < 200 || status >= 300) return { status: 'error' };
  const account = accountOf(body);
  return account ? { status: 'ready', mode: 'identity', account } : { status: 'error' };
}

function accountOf(value: unknown): CurrentAccount | null {
  if (typeof value !== 'object' || value === null) return null;
  const account = value as Record<string, unknown>;
  if (
    typeof account.id !== 'string' ||
    typeof account.email !== 'string' ||
    typeof account.displayName !== 'string' ||
    (account.role !== 'user' && account.role !== 'staff') ||
    typeof account.createdAt !== 'number'
  ) {
    return null;
  }
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    createdAt: account.createdAt,
  };
}
