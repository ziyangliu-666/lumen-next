# identity — LU YI

**Continuation:** read [NEXT_SESSION.md](../../../../../docs/luyi/NEXT_SESSION.md)
for unfinished work, the uncommitted checkpoint and next-session instructions.

**Latest-main safety update (2026-09-18):** the three deletion regressions are
fixed by a fail-closed retention gate. Full verify passes 394 tests with zero skips.
Current core lacks required ledger/session foreign keys, so even empty-account
deletion returns 409 and preserves account/login data. Successful deletion is
available only with validated, immediate restrictive retention constraints; test
fixtures are not production approval. See NEXT_SESSION.md for remaining blockers.

**Use case:** UC1 — sign up, sign in, manage the account
**Covers:** identity, email — sign-in, accounts, OAuth, email verification

## The design problem (from the proposal, section 6.4)

Four ways to become authenticated: GitHub, Google, email with password, and an
existing session. Each exchange differs, all of them must end in one session, and
a fifth must not change the session code.

**Candidate pattern:** Strategy with Template Method. This is the starting
hypothesis from the proposal, not the conclusion. You compare the candidates,
pick one, and write down why.

## Local login with PGlite

See [the local setup guide](../../../../../docs/luyi/LOCAL_AUTH.md). The standalone
`localPglite.ts` entry point serves real signup/login with disk persistence on
http://localhost:4000. It is not exported by this slice, not imported by main.ts,
and refuses production mode. Deployment still requires core's PostgreSQL wiring.

## Email verification and password recovery

MailSender/IdentityMail and resendMailSender are exported for composition-root
injection. With mailSender configured, identity registers verification status,
request/confirm email, forgot-password and reset-password routes. One-use codes
are hashed, purpose/account/email-bound and expire in 15 minutes. Reset revokes
all target login sessions and requires a fresh login. Candidate migration 004
must be applied before enabling mail. Local development defaults to a private
disk outbox; real delivery explicitly opts into a configured mail provider.
RecoveryPanel is accessible inside signin. See
[mail setup and policy limits](../../../../../docs/luyi/MAIL_SETUP.md). Verification
is not yet an access requirement; production delivery/abuse policies need review.

## OAuth and account self-service increment

GitHub and Google adapters/strategies and HTTP callbacks are implemented.
`createIdentitySlice` accepts optional `oauthProviders`; the public index exports
`githubProvider`, `googleProvider`, their client ports and OAuth strategy/types.
Providers are unavailable until configured; GET /api/auth/providers advertises
availability without secrets. Candidate migration 003_identity_oauth.sql must
be applied before enabling either provider. See
[OAuth setup and limitations](../../../../../docs/luyi/OAUTH_SETUP.md).

OAuth uses one-use state/browser binding, Google S256 PKCE, verified provider
email and no automatic email linking. Arctic is locally isolated because its
latest release is deprecated; production library approval/replacement is pending.
Real GitHub and Google local acceptance passed (see NEXT_SESSION.md). GitHub PKCE is not supplied by that
client version. Tokens never appear in account responses.

DELETE /api/me is implemented for password accounts with current-password proof.
Deletion relies on restrictive foreign keys to block retained resources (409).
The current core schema supplies that protection for projects, but not ledger
entries or session ownership. A PostgreSQL metadata gate now refuses deletion
unless all three have validated, immediate restrictive references and no competing
destructive FK. The check and deletion hold a conservative account-table lock
acquired before row locks. Missing protection yields 409 even for empty accounts;
no credentials/login-sessions/account are deleted. Owner-reviewed retention
migrations and contention review remain required to enable normal deletion. No cross-slice cascade or OAuth-only deletion is
implemented. AccountPanel lives inside the signin page folder and is accessible
from its "Manage signed-in account" button, pending reviewed Settings integration.

## Core authentication public interface

The public index exports `IdentityAuthentication` (principalResolver and
registerRoutes), implemented by `createIdentitySlice`. `postgresDatabase(pool)`
adapts core's supplied pg pool with transaction/rollback/release handling; it does
not own a pool or migration runner and still needs real PostgreSQL acceptance.
Any transaction query error makes the adapter rollback-only, even if the callback
catches it; savepoint-based error recovery is not part of this port. Core can depend on this
narrow interface without receiving the admin methods. Projects/steering consume
core's `requireUser(request).accountId` after resolver injection; they do not need
separate identity endpoints. GET /api/me remains the shell's account endpoint.

The optional PostgreSQL engine suite now composes identity's public index with
the actual session public index: real signup cookies, /api/me, session creation,
owner checks, forged client identity rejection and signout are exercised. This
does not implement project ownership validation or change production main.ts.

## Steering authentication handoff

See [the steering handoff](../../../../../docs/luyi/STEERING_HANDOFF.md) for
LI ZHUOYANG. `steeringHandoff.test.ts` exercises real password/cookie/HTTP/WS
identity against explicitly test-only resource handlers. It does not implement
steering. It also characterizes the open-socket revocation gap and unsupported
steer.cancel command so they remain visible for core/steering review.

## Admin account public interface

`createIdentitySlice(...)` returns an `IdentitySlice` implementing `AdminAccounts`:
`listAccounts()`, `getAccount(id)`, `setRole(id, role)` and `suspend(id, on)`.
The public index exports `AdminAccounts`, `AccountSummary`, `AdminAccountFailure`
and its code type. No global database singleton or admin HTTP route is added.

Admin reads include suspended accounts and only return id, email, displayName,
role, suspended and createdAt (epoch milliseconds). The list is ordered by
created_at then id; a missing account read returns null. Self-service reads are
unchanged and still exclude suspended accounts. Role changes take effect on
subsequent authenticated requests, without unsuspending accounts.

Billing must authorize staff and validate HTTP inputs before calling these
trusted methods. Mutation errors are typed: account_not_found, invalid_role and
invalid_suspension; infrastructure failures propagate. See
[the billing handoff](../../../../../docs/luyi/ADMIN_HANDOFF.md) for integration,
error mapping and outstanding release policies.

## Suspension policy

`createIdentitySlice(...).suspend(accountId, on)` is a trusted in-process admin
operation. Billing must authorize its caller with `requireStaff`; no admin HTTP
route is added here. A missing account rejects with AdminAccountFailure. Suspending updates
the account and deletes all its login sessions in one transaction. Unsuspending
does not restore sessions: the user must sign in again. Repeated suspension is
safe. Failure to delete sessions rolls back the suspension too.

Session insertion now requires `IdentityDatabase` (not just `IdentitySql`) and
locks the active account before checking any password proof and inserting. Suspension and issuance share that
lock order. Other slices must use this operation, never update `suspended`
directly. Already-running requests/open sockets are not forcibly disconnected.
Multi-connection locking acceptance still requires real PostgreSQL.

## Implementation status

The first building block is `authFlow.ts`, tested by `authFlow.test.ts`.
`AuthStrategy` varies credential verification; `AbstractAuthFlow<Result>` fixes
selection, verification and the shared `onAuthenticated` completion hook.
Unknown kinds and rejected credentials raise `AuthFailure`; unexpected failures
propagate without issuing a session or trying a different provider.

`VerifiedPrincipal` is identity-internal proof metadata, not a response DTO.
PasswordStrategy carries `expectedPasswordHash` through the completion hook;
AuthSessions passes it to NewAuthSession for the store to compare under the
account/credential locks before inserting. This closes the reset-between-password-
verification-and-issuance window without holding locks during scrypt. Adapters must
honor the optional proof check atomically. AuthSessions explicitly projects only
accountId/role into the issued principal; hashes never belong in HTTP responses,
cookies, logs or auth_sessions rows. OAuth/signup do not use a password proof.

The public index exports `AbstractAuthFlow`, `AuthStrategy`, `AuthFailure`,
`AuthFailureCode`, `PasswordStrategy`, `PasswordAccount` and `PasswordAccountStore`.
These remain available as building blocks; createIdentitySlice now composes the
SQL-backed resolver and route plugin, but main.ts does not mount it yet.

`PasswordStrategy` reads an injected account store, normalizes the email lookup
key and verifies the password with Node's scrypt. Missing/OAuth-only accounts do
dummy hash work; wrong passwords and suspended accounts return the same null
result. Roles come from storage, never from caller input. Storage failures
propagate instead of being misreported as invalid credentials.

`passwordHash.ts` uses a random 16-byte salt, a 64-byte digest, fixed scrypt work
factors (`N=32768, r=8, p=3`) and timing-safe digest comparison. Its 1024-byte
input ceiling limits resource use; it is not a signup password-strength policy.
AccountService validates new passwords (15 Unicode code points minimum, 1024
UTF-8 bytes maximum) without imposing that minimum on existing logins. This is a
provisional policy awaiting team review. The HTTP plugin requires a bounded local
LoginGate; deployment-wide/account-level abuse controls and load testing are
still needed before public exposure.

`AuthSessions` signs in by issuing a 32-byte random token and persisting only its
SHA-256 hash through `AuthSessionStore`. The caller supplies an explicit lifetime.
Verification checks expiry and suspension and reads the current principal from
storage. The store must join live accounts and implement deletion durably.
`revoke` deletes one token hash; `revokeAll` deletes an account's login sessions.

The public index additionally exports `AuthSessions`, `AuthSessionStore`,
`NewAuthSession`, `StoredAuthSession`, `IssuedAuthSession`, `AUTH_COOKIE`,
`SessionStrategy`, `SessionPrincipalResolver` and `SessionAuthFlow`.
`SessionAuthFlow` persists a login session in the common completion hook.
`SessionPrincipalResolver` reads only `lumen_session`, never the trusted dev
header, and checks it without issuing or renewing a session per request.

`identityRoutes(deps)` is a Fastify plugin, registered with
`await app.register(identityRoutes(deps))`. Its public dependencies are
`IdentityRouteDeps`, `AccountReader` and `AccountView`; `LoginGate` and
`LoginLimited` are also exported by the public index.

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/signup` | email, displayName, password; create user + credential, then login session; 201 + principal/cookie |
| `POST /api/auth/password` | JSON email/password to principal; token only in a host-only HttpOnly/Secure/SameSite=Lax cookie |
| `POST /api/auth/signout` | Idempotently revoke the current token and clear the cookie; 204 |
| `POST /api/auth/signout-all` | Require a user, revoke their login sessions and clear the cookie; 204 |
| `GET /api/me` | Require a user and return id, email, displayName, role and createdAt |
| `PATCH /api/me` | displayName and/or email; email change also requires currentPassword; 200 account |
| `POST /api/me/password` | currentPassword + newPassword; conditional credential replacement; 204 |

All mutation requests require an exact configured Origin; the plugin sets
Cache-Control: no-store, including error responses. It uses core's current
`{ error: string }` envelope. Secure cookies are the default; disabling Secure
requires an explicit loopback HTTP origin. Login bodies are bounded and primitive
credential types are checked before Fastify's schema coercion.

LoginGate bounds attempts, tracked direct socket peers and concurrent login work.
It does not trust X-Forwarded-For as a rate-limit key. Behind a proxy it groups
clients conservatively; a deployment-wide trusted-proxy/abuse policy is pending.

`AccountService`, `AccountStore`, `ProfilePatch`, `AccountFailure` and
`AccountFailureCode` are also exported. IdentityRouteDeps now requires
`management` (signup/update/changePassword) and `sessions.issue`. AccountStore
must create account+credential atomically, enforce normalized-email uniqueness
and compare the verified old hash during sensitive writes. Request bodies never
choose a role or target account id; writes target the authenticated account.

Domain invalid_body maps to 400; email_taken/account_changed to 409; wrong current
password to a generic 401. Signup's duplicate-email response intentionally exposes
registration availability and still needs the team's privacy-policy review.
Signup session-persistence failure leaves the created account intact and returns
500 without a cookie; callers can sign in afterwards. Password changes leave
existing sessions alive per the current submission. Email changes require a
password; OAuth-only reauthentication/email verification remain separate work.

`PostgresAccountStore` now implements AccountStore and PasswordAccountStore with
parameterized SQL. `PostgresAuthSessionStore` implements AuthSessionStore.
`IdentityDatabase` and `IdentitySql` are the injected query/transaction ports;
core must supply the shared pool, not a private identity database. Signup uses one
transaction for account + credential, and sensitive writes lock account then
credential before comparing the verified hash. Current role/suspension is joined
on session lookup. All these types/classes are exported through index.ts.

`createIdentitySlice(options)` returns `{ principalResolver, registerRoutes }`.
Its exported `IdentitySliceOptions` requires database, origin, sessionLifetimeMs
and loginGate, with optional secureCookies; `IdentitySlice` is the return type.
The factory uses SQL stores only and does not fall back to a development header.
The migration at `migrations/002_identity_auth.sql` is a review candidate: core
must assign its final number and apply it transactionally with the shared runner.
It is not automatically executed and has no destructive down migration.

OAuth and restricted password-account deletion are now implemented as described
above. Mail/verification/reset code and local outbox are also implemented. Real
GitHub/Google local acceptance and Resend verification-mail acceptance passed.
Real external password reset, OAuth-only reauthentication, deletion of accounts
with retained resources and production wiring remain unfinished.
Immediate socket revocation still needs design and review. The development auth
stub in main.ts is unchanged. Only tests use in-memory adapters/engines. The
sign-in page calls the real endpoint paths, but the application cannot authenticate
durably until core provides the pool/runner and mounts the factory's plugin.

See [PERSISTENCE.md](../../../../../docs/luyi/PERSISTENCE.md) for the database
handoff, optional PostgreSQL WASM tests and the new opt-in `postgresLive.test.ts`
real-pg concurrency suite. Its 18 tests passed on native PostgreSQL 17.10 with
external pg 8.23.0 on 2026-09-18; combined verify passed 339 tests with zero skips.
A separate local clean PostgreSQL stop/start persistence probe also passed.
A disposable database and external pg module remain required to rerun this suite.
Transport-failure/crash-recovery and production composition acceptance remain pending.
[RUNTIME_API.md](../../../../../docs/luyi/RUNTIME_API.md) maps the historical
submission to the current implementation without claiming team contract approval.

Full backlog and integration prerequisites: [`PLAN.md`](../../../../../docs/luyi/PLAN.md).
Earlier HTTP increment: [`HTTP_PLAN.md`](../../../../../docs/luyi/HTTP_PLAN.md).

See [`SESSION_PLAN.md`](../../../../../docs/luyi/SESSION_PLAN.md) for the session
plan, estimate, token calculations and pending integration requirements.

The before/after design and integration checklist are in
[`docs/luyi/IMPLEMENTATION.md`](../../../../../docs/luyi/IMPLEMENTATION.md).
Write a unit test for every class that carries the pattern.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/identity`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
