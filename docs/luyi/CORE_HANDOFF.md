# Identity integration design: core, session and shell

Owner of identity: LU YI. Integration owner: LIU ZIYANG.
Status: proposed wiring/acceptance plan, grounded in the current branch on
2026-09-18. This document does not change shared code or claim deployment.

## 1. Responsibility boundary

| Area | Identity supplies | Core/session/shell owns |
|---|---|---|
| Authentication | Cookie issuance, verification, expiry/revocation and current account role | Inject resolver into the shared server; never retain a stub fallback |
| HTTP | identity.registerRoutes and GET /api/me | Mount plugins and configure HTTPS origin, cookies and error handling |
| Database | PostgreSQL stores and IdentityDatabase port | Shared pg pool, transaction adapter, reviewed migration runner |
| Session authorization | Trusted accountId and role | Project/session ownership checks, access.canWatch and command authorization |
| Frontend | Sign-in/signup form and identity HTTP contract | One login-state store, protected navigation, cache/socket cleanup |
| Live revocation | Durable login-session deletion and suspension | Revalidate/disconnect existing sockets and handle in-flight requests |

No new authentication microservice, shared secret or browser-readable bearer
token is needed. Identity does not import core's composition root or implement
resource ownership.

## 2. Existing interfaces

```ts
// Import via modules/identity/index.js from the composition root.
createIdentitySlice(options: IdentitySliceOptions): IdentitySlice;
// options: database, origin, sessionLifetimeMs, loginGate, secureCookies?
// instance: principalResolver, registerRoutes, listAccounts, getAccount,
//           setRole, suspend
```

PrincipalResolver implements core's existing resolve(credentials) contract:

```ts
interface Credentials {
  authorization?: string | undefined;
  cookies: Readonly<Record<string, string | undefined>>;
}
interface Principal {
  accountId: string;
  role: 'user' | 'staff';
}
// resolve(credentials): Promise<Principal | null>
```

Cookie name: lumen_session. Identity ignores stub credentials. Malformed, expired,
revoked or suspended sessions resolve to null. Unexpected database failures must
propagate as infrastructure errors, never become a fake successful principal.

`GET /api/me` returns `{ id, email, displayName, role, createdAt }`, where createdAt
is epoch milliseconds. It returns 401 for anonymous callers and no-store on every
identity response. Do not confuse its `id` with login's `{ accountId, role }`
response or the admin getAccount method that also includes suspended accounts.

## 3. Composition-root sequence

Proposed owner-reviewed steps in main.ts (not applied by identity):

1. Open the shared PostgreSQL pool and run reviewed migrations once.
2. Adapt that pool to IdentityDatabase. Transactions use one checked-out client,
   commit only on success, roll back on failure and release the client.
3. Create Broker and the actual session slice.
4. Create identity once with the configured canonical public origin, session
   lifetime and bounded LoginGate. Use Secure cookies for HTTPS deployment.
5. Call buildServer with identity.principalResolver, broker and session.access.
6. Register identity.registerRoutes and each slice's routes/commands.
7. Pass identity's AdminAccounts surface to billing through composition, without
   giving billing direct account-table access.
8. Listen only after successful database initialization; drain HTTP/WS before
   closing the shared pool on shutdown.

The PGlite local bootstrap is not the deployment entry point or migration runner.
See PERSISTENCE.md for the adapter/transaction obligations. Do not silently fall
back to headerStub if a database, cookie or configuration check fails.

## 4. Shell login state design (proposed)

Use one shared shell-owned auth state, not page-local copies:

```text
loading -> authenticated(account) | anonymous | unavailable
```

- App startup: call GET /api/me with same-origin cookies. Keep protected content
  hidden while loading; deduplicate concurrent checks with the shared API/query layer.
- 200: cache the safe account view. Do not store passwords or session tokens.
- 401: anonymous; send protected navigation to #/signin.
- Network/5xx: unavailable with retry. Do not pretend the user signed out and do
  not render privileged content based on stale cached role.
- Successful sign-in/signup: invalidate/refetch /api/me, then route users to
  #/home and staff to #/admin. Coordinate this with the current SignIn page,
  which presently changes the hash directly.
- Entering #/admin: shell checks current authenticated role; a member receives a
  safe non-admin destination/message. Backend requireStaff remains mandatory.
- Signout/signout-all: send the mutation with cookie and Origin; on success clear
  account/resource caches, close local sockets and navigate to #/signin. On
  failure show an error; local state clearing alone is not server revocation.
- Switching accounts must clear previous account resource caches/subscriptions.
  The account ID can be a cache key, but never supplies server authorization.
- A later protected-request 401 invalidates login state and closes local sockets.
  A 403 is authorization failure, not automatically a request to sign out.

The real cookie is HttpOnly. Replace stubAccount/signInStub uses; do not decode
lumen_session from document.cookie or synthesize staff roles in browser storage.
A multi-tab notification may prompt other tabs to refetch/close, but is a UX aid,
not an authorization control. The exact shell state API is owned by LIU ZIYANG.

## 5. HTTP and WebSocket boundaries

HTTP: core resolves the principal before handlers. Each route calls requireUser
or requireStaff; the owning slice checks the target resource. Identity's Origin
hook is scoped to its plugin and does not protect other slices' mutations.

Current WS URL: /ws?session=<id>. Core resolves identity before upgrade, then
session.access.canWatch checks the session. Invalid identity returns 401; an
inaccessible session returns 404. Commands with taskId need slice-owned target
lookup; a permitted subscription is not permission to steer arbitrary tasks.

Current gap: wsBridge captures the handshake principal. Role changes, signout
and suspension are not rechecked on subsequent frames, and subscribed outbound
events continue. Already-open sockets therefore need a reviewed design:

- Preferred contract to discuss: core retains a server-side session reference and
  revalidates before each command; invalidation also closes subscriptions so no
  outbound data continues after revocation.
- Account-only lookups are insufficient for single-session signout or expiry.
- Across multiple server processes, an in-memory disconnect notification alone
  is insufficient; agree invalidation delivery/recheck semantics and latency.
- Do not expose tokens in frame bodies, logs, URLs or the browser account state.
- Add an exact allowed-Origin policy for browser WebSocket handshakes. It is
  currently absent from wsBridge; cookie SameSite is not a full substitute.

This is a design requirement, not a claim that these mechanisms exist. See
STEERING_HANDOFF.md for the executable characterization of the open-socket gap.

## 6. Session-specific issue to resolve

POST /api/projects/:id/sessions currently trusts the supplied projectId and
records the authenticated caller as session owner. A valid login alone does not
prove that project belongs to that caller. Before starting work, session must
obtain a project-by-ID ownership check from projects. Architecture's proposed
projectOf(sessionId) cannot answer ownership before a session exists.

Kernel currently permits staff access to another account's session. Agree that
staff read/control policy with projects and steering rather than assuming every
slice grants the same bypass. See PROJECTS_HANDOFF.md.

## 7. Acceptance matrix and evidence limits

| Case | Required result |
|---|---|
| Signup/login then /api/me | Matching account; user/staff role comes from DB |
| Stub header or missing/expired cookie | 401 on protected HTTP; no WS upgrade |
| A opens own session; B reads/stops/subscribes | A succeeds; B gets consistent 404 |
| A starts under B's project ID | Denied before session/work creation |
| Member navigates directly to #/admin | No admin content; backend still refuses admin calls |
| Signout + reload/reconnect | Old cookie rejected; shell not treated as authenticated |
| Suspend, unsuspend | All old cookies remain invalid; fresh login required |
| Role downgrade on already-open socket | Privileged actions/data access cease under agreed revocation policy |
| Same-origin vs foreign-Origin mutation/WS | Trusted flow succeeds; foreign flow rejected |
| Database outage at startup/request | No fallback stub or success; safe error/retry behavior |

Identity SQL/HTTP and steering-boundary tests cover parts of this matrix. They do
not prove actual shell guards, resource-owner lookup, active WS revocation,
production PostgreSQL wiring or reviewed deployment. Those are pending integration
acceptance. No core/session/shell code is changed by this design document.
