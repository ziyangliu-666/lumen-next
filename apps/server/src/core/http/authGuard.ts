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

// What a request carries that could identify its sender. The header is what a
// tool or a test sends; the cookie is what a browser sends, because the
// WebSocket API cannot set a header and the event stream is authenticated
// before the upgrade. One resolver reads both, so a route and a socket agree
// on who is asking.
export interface Credentials {
  readonly authorization?: string | undefined;
  readonly cookies: Readonly<Record<string, string | undefined>>;
}

// How the router turns a raw credential into a principal. One implementation
// per way in; the router is built with one and never learns which.
export interface PrincipalResolver {
  resolve(from: Credentials): Promise<Principal | null>;
}

/** The cookie the stub reads. Identity's real cookie has its own name. */
export const STUB_COOKIE = 'lumen_stub';

/**
 * Sprint 1's resolver: trusts `Authorization: stub <id>:<role>`, or the same
 * value in the `lumen_stub` cookie. Anyone can claim any account with it, so
 * it must never resolve a request that reached a real deployment.
 */
export const headerStub: PrincipalResolver = {
  resolve(from: Credentials): Promise<Principal | null> {
    const raw = from.authorization ?? from.cookies[STUB_COOKIE];
    return Promise.resolve(principalFromHeader(raw));
  },
};

// Authenticated is not authorised. A principal says who is asking; this says
// whether that principal may have what they asked for. The event stream needs
// the second question answered before it opens a socket, because a session id
// travels in a URL and is not a credential.
export interface SessionAccess {
  canWatch(principal: Principal, sessionId: string): Promise<boolean>;
}

/**
 * Sprint 1 only, and a hole for as long as it lasts: this lets any signed-in
 * principal watch any session, including one they have never opened.
 *
 * It is here so the seam is here. `ServerDeps.access` is required, so the
 * server cannot be built without an answer to "who may watch this?", and the
 * slice that closes the hole replaces an object rather than remembering to add
 * a check nobody wrote down.
 *
 * main.ts no longer uses it: the session slice answers from its own record of
 * who opened each session. This stays for tests, and as the shape a slice
 * implements.
 */
export const anySignedInMayWatch: SessionAccess = {
  canWatch: () => Promise.resolve(true),
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
