# Identity API

Owner: LU YI. Sprint 2 delivers password authentication. OAuth, email verification
and recovery are implemented but not wired by `main.ts`. Account deletion is
`DELETE /api/me` (below). See [local setup](LOCAL_AUTH.md), [OAuth](OAUTH_SETUP.md) and
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
| DELETE /api/me | authenticated; `{ currentPassword }`, or `{}` without a password | 204, account tombstoned, every session revoked, cookie cleared |
| GET /api/auth/providers | none | `{ github: false, google: false }` until configured |
| GET /api/auth/mail | none | `{ enabled: false }` until configured |

## Account deletion

`DELETE /api/me` deletes the signed-in account, immediately and irreversibly.
Only the user deletes, and only their own account: the id comes from the
session, and a body field other than `currentPassword` is 400. Staff have no
deletion route or in-process method; they suspend through billing's admin page.

Reauthentication is the confirmation:

- An account with a password sends `{ "currentPassword": "..." }`. Wrong or
  missing is 401; a password changed concurrently is 409.
- An account without a password (GitHub or Google only) sends `{}`. The
  session making the request must have been issued within the last 10 minutes,
  so the person signs in with the provider again first. Otherwise 401. Sending
  a password for such an account is also 401.
- Failures count against the account's LoginGate budget, as for a
  password change. Missing sign-in is 401; wrong Origin is 403.

The `accounts` row stays as a tombstone, because other slices' rows keep its
id: projects, sessions, tasks, steps, ledger entries and wallets are untouched.
In one transaction, under the account lock and after rechecking the proof:

- `email` becomes `deleted+<id>@invalid`, `display_name` becomes
  `Deleted account`, `role` becomes `user`, `suspended` is set and
  `deleted_at` records the time. Signup and profile validation require a dot in
  the domain, so the placeholder can never be registered.
- `credentials` (password and every OAuth link), `auth_sessions`,
  `identity_mail_tokens`, `identity_email_verifications`, and
  `identity_mail_requests` for the account or its old address are deleted.

After deletion every old cookie is 401, password sign-in fails, and the old
email is free to register as a new account. The provider identity no longer
reaches the tombstone: signing in with it again creates a new account. Staff
administration (`listAccounts`, `getAccount`, `setRole`, `suspend`) treats a
tombstone as not found, and a check constraint keeps it suspended. Open
WebSockets keep their handshake principal until core revalidates them, the same
known limit as suspension.

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
`003_identity_oauth`, `004_identity_mail`, `009_identity_mail_queue` and
`010_identity_account_deletion` are applied. Migration 010 adds the nullable
`accounts.deleted_at` and a check that a tombstone stays suspended. Migration 002 adds
`accounts.suspended` and uniqueness on normalized email. Existing duplicate
normalized emails make migration fail; review and resolve them before rollout.

Password credentials use salted scrypt; session storage keeps only SHA-256 hashes
of random 32-byte tokens. Account writes and issuance lock account before
credential. Password changes compare the verified old hash and revoke other
sessions in the same transaction. A failed revocation rolls back the new hash.
Suspension also revokes sessions atomically; unsuspension does not restore them.
Deletion revokes every session in its own transaction; see Account deletion.
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
