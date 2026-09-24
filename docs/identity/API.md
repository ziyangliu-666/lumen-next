# Identity API

Owner: LU YI. Sprint 2 delivers password authentication. OAuth, email verification
and recovery are implemented but not wired by `main.ts`; account deletion is
excluded. See [local setup](LOCAL_AUTH.md), [OAuth](OAUTH_SETUP.md) and
[mail](MAIL_SETUP.md).

## HTTP

All identity mutations require the exact configured `Origin`. Responses use
`Cache-Control: no-store`. The host-only `lumen_session` cookie is HttpOnly,
SameSite=Lax and Secure by default. Plain HTTP cookies are allowed only with an
explicit loopback origin. Tokens never appear in JSON or browser storage.

| Endpoint | Input | Success |
|---|---|---|
| POST /api/auth/signup | email, displayName, password | 201, `{ accountId, role }`, cookie |
| POST /api/auth/password | email, password | 200, `{ accountId, role }`, cookie |
| POST /api/auth/signout | none | 204, revoke current cookie; idempotent |
| POST /api/auth/signout-all | authenticated | 204, revoke all account sessions |
| GET /api/me | authenticated | 200, `{ id, email, displayName, role, createdAt }` |
| PATCH /api/me | displayName and/or email; currentPassword for email | 200, account |
| POST /api/me/password | currentPassword, newPassword | 204, retain current session, revoke all others |
| GET /api/auth/providers | none | `{ github: false, google: false }` until configured |
| GET /api/auth/mail | none | `{ enabled: false }` until configured |

`DELETE /api/me` is not registered. The shared schema lacks the retention foreign
keys needed for safe deletion. The account panel contains no deletion control.

Emails are trimmed and lowercased. Names contain 1–80 characters. New passwords
contain at least 8 Unicode code points and at most 1024 UTF-8 bytes; existing
password login does not impose the signup minimum. Password whitespace is kept.
Signup/profile bodies reject caller-supplied roles and account IDs. Signup always
creates a user. Staff use the same sign-in page and go to `#/admin`; users go to
`#/home`. The admin page and its HTTP implementation belong to billing.

Current core errors are `{ error: string }`: 400 invalid body, 401 missing login
or invalid credentials, 403 wrong Origin, 409 duplicate email or stale account
proof, 429 admission limit, 500 infrastructure failure. Do not branch on an
English message. Signup currently exposes email availability through 409; public
release needs an explicit enumeration policy.

`LoginGate` bounds concurrent work and tracked keys. It counts rejected actions,
not successful sign-ins or profile updates, with direct-peer and account limits.
Email keys are normalized and hashed. It does not trust `X-Forwarded-For` and is
not a distributed limiter. A proxy's failed requests still share a peer budget.

## Public index and persistence

`createIdentitySlice({ database, origin, sessionLifetimeMs, loginGate,
secureCookies?, oauthProviders?, mailSender?, mailDeliveryFailed? })` returns:

- `principalResolver`: reads only the session cookie, verifies expiry/suspension,
  and resolves the current account role on every request; never renews a session.
- `registerRoutes`: a Fastify plugin with encapsulated identity hooks.
- `listAccounts`, `getAccount`, `setRole`, `suspend`: trusted in-process methods.
  Billing must authorize staff before calling them. Summaries include id, email,
  displayName, role, suspended and createdAt, never credentials or tokens.
  Missing reads return null; mutations throw typed `AdminAccountFailure`.

`oauthProvidersFromEnvironment(environment, origin)` returns optional GitHub and
Google providers built on the in-slice OAuth clients. The caller explicitly supplies server-only
configuration; the helper does not read global environment or contact providers.
Empty credential pairs disable providers; partial/malformed pairs fail without
echoing values. Enabled providers require a canonical HTTPS origin by default.
A third argument `{ allowLoopbackHttp: true }` explicitly permits only canonical
loopback HTTP for local acceptance; the default and production wiring stay HTTPS.
The caller
must inject the returned providers into createIdentitySlice; production startup
has not yet been changed to do so. See [OAuth setup](OAUTH_SETUP.md).

Core owns the pool and migration runner. Only `core/db/migrations/002_identity_auth`,
`003_identity_oauth`, and `004_identity_mail` are applied. Migration 002 adds
`accounts.suspended` and uniqueness on normalized email. Existing duplicate
normalized emails make migration fail; review and resolve them before rollout.

Password credentials use salted scrypt; session storage keeps only SHA-256 hashes
of random 32-byte tokens. Account writes and issuance lock account before
credential. Password changes compare the verified old hash and revoke other
sessions in the same transaction. A failed revocation rolls back the new hash.
Suspension also revokes sessions atomically; unsuspension does not restore them.
An already-open WebSocket retains its handshake principal: immediate revocation
needs shared core work and is not claimed here.

## Pattern and tests

Before: a branch per credential kind duplicates verification and session creation.
After: `AuthStrategy` varies verification; `AbstractAuthFlow` fixes selection,
verification and completion; `SessionAuthFlow` issues one session on success.
`SessionStrategy` resolves existing sessions but is deliberately not registered
as a session-minting strategy. A fifth strategy does not change the template.
The seven historical analysis/design figures are under `diagrams/`; the code and
this API describe the current Sprint 2 runtime scope, not every planned feature.

Unit tests prove selection, rejection and shared completion. SQL/HTTP tests use
`openTestDb()` and CI's `DATABASE_URL`, including real concurrent transactions,
rollback, session isolation and persistence across connection-pool restarts.
