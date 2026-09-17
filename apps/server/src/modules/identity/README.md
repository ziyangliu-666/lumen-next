# identity — LU YI

**Use case:** UC1 — sign up, sign in, manage the account
**Covers:** identity, email — sign-in, accounts, OAuth, email verification

## The design problem (from the proposal, section 6.4)

Four ways to become authenticated: GitHub, Google, email with password, and an
existing session. Each exchange differs, all of them must end in one session, and
a fifth must not change the session code.

**Candidate pattern:** Strategy with Template Method. This is the starting
hypothesis from the proposal, not the conclusion. You compare the candidates,
pick one, and write down why.

## Implementation status

The first building block is `authFlow.ts`, tested by `authFlow.test.ts`.
`AuthStrategy` varies credential verification; `AbstractAuthFlow<Result>` fixes
selection, verification and the shared `onAuthenticated` completion hook.
Unknown kinds and rejected credentials raise `AuthFailure`; unexpected failures
propagate without issuing a session or trying a different provider.

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

Account deletion, OAuth, mail and production wiring are not implemented yet.
Immediate socket revocation still needs design and review. The development auth
stub in main.ts is unchanged. Only tests use in-memory adapters/engines. The
sign-in page calls the real endpoint paths, but the application cannot authenticate
durably until core provides the pool/runner and mounts the factory's plugin.

See [PERSISTENCE.md](../../../../../docs/luyi/PERSISTENCE.md) for the database
handoff and optional PostgreSQL WASM tests (not multi-connection acceptance).
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
