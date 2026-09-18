export interface AdminAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: 'user' | 'staff';
  readonly suspended: boolean;
  readonly createdAt: number;
}

export class AdminRequestFailure extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? 'Your session has expired. Sign in again.'
        : status === 403
          ? 'Your account no longer has administrator access.'
          : status === 404
            ? 'This account no longer exists.'
            : 'Unable to load administrator data. Try again.',
    );
    this.name = 'AdminRequestFailure';
  }
}

function accountOf(value: unknown): AdminAccount | null {
  if (typeof value !== 'object' || value === null) return null;
  const account = value as Record<string, unknown>;
  if (
    typeof account.id !== 'string' ||
    typeof account.email !== 'string' ||
    typeof account.displayName !== 'string' ||
    (account.role !== 'user' && account.role !== 'staff') ||
    typeof account.suspended !== 'boolean' ||
    typeof account.createdAt !== 'number'
  ) {
    return null;
  }
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    suspended: account.suspended,
    createdAt: account.createdAt,
  };
}

async function request(path: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AdminRequestFailure(0);
  }
  if (!response.ok) throw new AdminRequestFailure(response.status);
  return response.json().catch(() => {
    throw new AdminRequestFailure(500);
  });
}

export async function listAdminAccounts(signal: AbortSignal): Promise<AdminAccount[]> {
  const value = await request('/api/admin/accounts', signal);
  if (!Array.isArray(value)) throw new AdminRequestFailure(500);
  const accounts = value.map(accountOf);
  if (accounts.some((account) => account === null)) throw new AdminRequestFailure(500);
  return accounts as AdminAccount[];
}

export async function getAdminAccount(id: string, signal: AbortSignal): Promise<AdminAccount> {
  const account = accountOf(await request(`/api/admin/accounts/${encodeURIComponent(id)}`, signal));
  if (!account) throw new AdminRequestFailure(500);
  return account;
}
