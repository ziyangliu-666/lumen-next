import type { TaskStatus } from '@lumen/contracts';

// Every route passes through here. Sprint 1: a stub that trusts a header so the
// other slices can develop against a known account. LU YI replaces it in the
// identity slice with real session verification.
export interface Principal {
  readonly accountId: string;
  readonly role: 'user' | 'staff';
}

export function principalFromHeader(header: string | undefined): Principal | null {
  if (!header) return null;
  // Format during Sprint 1 only: "stub <accountId>:<role>".
  const match = /^stub ([^:]+):(user|staff)$/.exec(header);
  if (!match) return null;
  return { accountId: match[1]!, role: match[2] as 'user' | 'staff' };
}

export function canReadStatus(_status: TaskStatus): boolean {
  return true;
}
