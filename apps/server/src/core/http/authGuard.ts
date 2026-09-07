import type { TaskStatus } from '@lumen/contracts';
import { forbidden, unauthorized } from './httpError.js';

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

// How the router turns a raw credential into a principal. One implementation
// per way in; the router is built with one and never learns which.
export interface PrincipalResolver {
  resolve(raw: string | undefined): Promise<Principal | null>;
}

/** Sprint 1's resolver: trusts `Authorization: stub <id>:<role>`. */
export const headerStub: PrincipalResolver = {
  resolve(raw: string | undefined): Promise<Principal | null> {
    return Promise.resolve(principalFromHeader(raw));
  },
};

// The two lines a handler writes to state who it serves. They take the smallest
// shape that carries a principal rather than the router's Request, so that
// authGuard and router do not import each other.
export function requireUser(request: { readonly principal: Principal | null }): Principal {
  if (!request.principal) throw unauthorized();
  return request.principal;
}

export function requireStaff(request: { readonly principal: Principal | null }): Principal {
  const principal = requireUser(request);
  if (principal.role !== 'staff') throw forbidden('staff only');
  return principal;
}
