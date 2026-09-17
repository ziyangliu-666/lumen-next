# Identity implementation and integration checklist

Publication update: the implementation is now committed and pushed to the
personal `mine/identity/auth-flow` branch. See CONTEXT.md for commit references.
The dated-in-sequence checkpoints below describe the state before publication;
their uncommitted-work remarks are historical. No team PR/review or deployment
has happened yet.

## Current story: authentication flow

Branch: `identity/auth-flow`, based on the design branch after merging team main at `40bcdab`.

Start with a tested Strategy + Template Method, without HTTP, SQL, OAuth or changes to other slices. `AuthStrategy.verify` takes untrusted input and returns a principal or null. `AbstractAuthFlow.authenticate` selects one strategy, verifies once, and invokes one completion hook only on success. A concrete production flow will later implement that hook to persist a login session. Resolving a cookie on ordinary requests must not create a new session per request.

Before: a switch for password/session/GitHub/Google repeats verification and session issuance in each arm. Adding a provider requires editing the switch and risks forgetting the shared completion step.

After: a registry holds strategies; one template method owns selection, verification and completion. A fifth strategy is registered without changing the algorithm. Tests prove completion is called once after successful verification and never after rejection or failure. Domain failures remain independent of the unresolved HTTP error-envelope decision.

### Validation checkpoint

Implemented `authFlow.ts`, exported its building blocks through the public index,
and added 9 tests. The initial test run failed because the implementation did not
exist. After implementation, `npm run verify` passed: 72 tests total and 96.75%
line coverage. No production authentication wiring or other slice was changed.
These local changes have not been committed, pushed or reviewed.

## Next stories (not shipped by the first story)

1. Password hashing/verification and repository port: implemented locally as `passwordHash.ts` and `passwordStrategy.ts`, with tests. No concrete repository or HTTP route yet.
2. Durable accounts, credentials and hashed login-session tokens; coordinate migrations with the core owner.
3. Session service, Strategy and cookie resolver implemented against storage ports; tested with expiry, revocation and suspended-account checks. No fallback to the trusted development header. Durable adapter and production wiring remain pending.
4. Signup/password/signout/signout-all/me/profile/password-change routes implemented as an unmounted Fastify plugin, with validation, exact-origin mutation checks, cookie security and local login admission limits. Account deletion and deployment-wide abuse controls remain pending.
5. Sign-in/signup UI implemented; real backend integration, owner-reviewed composition-root wiring and coordinated Account tab remain pending.
6. GitHub/Google via arctic, email, and billing's account public index.

No first-story class is a working sign-in endpoint. Do not replace the stub until the durable session and route integration has passed review and tests.

## Password strategy checkpoint

Validation: 30 new password tests; `npm run verify` passes with 102 total tests,
97.08% line coverage and no lint warnings. Tests were written and run before
implementation. `git diff --check` passes. Changes remain uncommitted.

- PasswordAccountStore is an injected lookup port; AccountRepo will implement it later. No SQL or fake production database was added.
- Email lookup uses trim + lowercase. Signup storage must use the same normalization and enforce uniqueness. Full signup address validation remains pending.
- Passwords are not trimmed or normalized. A 1..1024 UTF-8 byte bound is an internal resource limit, not approval of a one-character signup password; the signup minimum/strength policy still needs a decision.
- The versioned scrypt format fixes N=32768, r=8, p=3 with a random 16-byte salt and a 64-byte digest. No stored work-factor field can increase CPU/memory usage. Benchmark these parameters and add login rate/concurrency limits before HTTP exposure.
- Missing/password-less accounts still execute a dummy hash check. They cannot authenticate even if the injected verifier reports a match. This reduces a simple timing signal; it does not promise constant-time end-to-end requests.
- Malformed input, rejected passwords and suspended accounts do not return a principal. Infrastructure errors propagate, and caller-supplied roles are ignored.

## Login-session checkpoint

Plan and estimate were recorded before implementation in `SESSION_PLAN.md`.
Implemented `AuthSessions`, the `AuthSessionStore` port, `SessionStrategy`,
`SessionPrincipalResolver` and `SessionAuthFlow`. No database adapter was added.
Tests use an explicit in-memory test double only.

Validation: 39 new tests, 141 total passing; `npm run verify` passes with 97.48%
line coverage. `git diff --check` passes. A Fastify integration test proves core
passes cookies to this resolver, requireUser rejects anonymous/stub callers,
a valid session succeeds and a revoked session fails on the next request.
This is not an end-to-end sign-in UI, a database test or a steering-route test.
All implementation work remains local, uncommitted and unreviewed.

## HTTP checkpoint

Plan: `HTTP_PLAN.md`. Implemented `identityRoutes` (password, signout,
signout-all, me) and the bounded local `LoginGate`. Tested credential failure,
cookie flags, origin rejection, raw credential types, rate limits, forged proxy
headers, token revocation, public account projection and generic storage errors.

Validation: 25 new tests; `npm run verify` passes with 166 total tests and 97.74%
line coverage. `git diff --check` passes. No new dependencies, shared-core edits
or production test-store wiring. Origin was fetched again; its database layer
still has only schema.sql. Concrete AccountReader/PasswordAccountStore/
AuthSessionStore adapters and signup remain the next integration prerequisites.

## Signup, account management and sign-in page checkpoint

Full backlog: `PLAN.md`. Added AccountService and AccountStore contracts, signup,
profile and password-change routes. New accounts cannot choose privileges;
email/password changes require current-password proof and atomic conditional
writes by the adapter. The provisional new-password minimum is 15 Unicode code
points. Existing sessions survive password changes per the current design.

The existing #/signin page now has sign-in/signup modes, confirmation validation,
busy/error states and fixed user/staff redirects. OAuth is explicitly disabled.
Settings Account is not edited; its ownership boundary remains unresolved.

Validation: 35 new service/route tests, 201 total passing, 97.79% line coverage;
full verify, web build and git diff --check pass. Browser checks used intercepted
API responses, not a production backend, and covered desktop/mobile layouts and
form/error/redirect behavior. No real database or production sign-in is claimed.

## Coordination with LI ZHUOYANG

Observed remote checkpoint: `origin/steering/sandbox-foundations` at `9af4264`. Its design and public index describe files routes, SandboxFs and a steer queue. Worker/compute and steering command registration remain follow-ups. This branch was inspected, not merged or independently verified here.

### Agreed shared boundary to build against

- Identity supplies a `PrincipalResolver` to core at server construction.
- Core decorates requests with `Principal | null`; steering continues calling `requireUser(request)`.
- Principal remains `{ accountId: string, role: 'user' | 'staff' }`.
- Steering must not parse identity's cookies, read credentials tables or import identity internals.
- Authentication is not project authorization. Steering's current files routes trust the project id after `requireUser`; projects must supply an ownership lookup/check and steering must apply it before touching the filesystem. Coordinate this with PENG XUJIAN; identity cannot infer project ownership.
- WebSocket identity uses the same resolver. Session/task ownership and command authorization remain the owning slices' responsibility.

### Joint acceptance tests when real authentication lands

- Missing, forged, expired or revoked session: protected files routes return 401.
- Account A can access its own project's files.
- Account B cannot list or read A's files, even with a valid login cookie and a known project id.
- Traversal and inaccessible file responses remain non-disclosing.
- HTTP and WebSocket resolve the same account; unauthorized subscriptions/commands are refused by the owning slice.
- Signout prevents subsequent authenticated requests. Agree separately how already-open sockets are revoked; handshake-only validation does not provide immediate revocation.

### Message to send to the team (not sent automatically)

Identity is starting against core's existing PrincipalResolver and will preserve Principal { accountId, role }. Steering can keep requireUser(request), without importing identity internals. Before integration, please coordinate a project ownership check with projects: the current files routes only check that the caller is signed in. Once the resolver and auth routes ship, we should jointly test anonymous access, own-project access, cross-account denial and expired/revoked sessions. Please confirm your latest branch/PR and whether ownership checks have changed since 9af4264.
