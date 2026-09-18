# UC1 current implementation contract

This is the contract implemented by identityRoutes and createIdentitySlice on the
working implementation branch. It supersedes historical API examples in API.md
and design.docx for client development; it is not a claim of team approval or
production availability. main.ts has not mounted this plugin yet.

## Transport and authentication

JSON over same-origin HTTPS. Every mutation must include the exact configured
Origin. Missing/mismatched Origin returns 403, including for signout. Cookies are
host-only, Path=/, HttpOnly, Secure and SameSite=Lax; Secure may be disabled only
with an explicit loopback HTTP origin. All identity responses have no-store.

The cookie is lumen_session. Cookie verification does not issue/renew a session.
A development stub header cannot authenticate through SessionPrincipalResolver.
The principal is `{ accountId, role }`, with role `user | staff`. Account responses
are `{ id, email, displayName, role, createdAt }`, where createdAt is epoch
milliseconds. Hashes/tokens are never returned in JSON.

## Implemented endpoints (when mounted)

| Method and path | Input | Success |
|---|---|---|
| POST /api/auth/signup | email, displayName, password | 201, principal directly (not wrapped), session cookie |
| POST /api/auth/password | email, password | 200, principal directly, session cookie |
| POST /api/auth/signout | session cookie if present | 204, revoke current session and clear cookie; idempotent |
| POST /api/auth/signout-all | valid session cookie | 204, revoke all account sessions and clear cookie |
| GET /api/me | valid session cookie | 200, account |
| PATCH /api/me | displayName and/or email; currentPassword required for email | 200, updated account |
| POST /api/me/password | currentPassword, newPassword; valid session | 204; other sessions remain valid |

New passwords require at least 15 Unicode code points and at most 1024 UTF-8 bytes,
without trimming/normalization or forced character classes. Existing password
login does not impose this new minimum. Display names are trimmed to 1..80 UTF-16
code units. Emails are trimmed/lowercased and bounded to 320 characters; syntax
validation does not verify mailbox ownership. These policies still need review.

Signup always creates a user; the caller cannot choose an id, role or suspension.
Account changes target the authenticated account. Email/password writes compare
the verified credential hash under database locks; stale proof is a conflict.
Signup session creation is separate from the account transaction: on session
storage failure the account remains and the caller can try password sign-in.

## OAuth and account deletion additions

- GET /api/auth/providers returns configured github/google booleans.
- GET /api/auth/github and /google redirect to configured providers.
- GET /api/auth/github/callback and /google/callback validate the one-use browser
  binding/state, exchange the code, resolve the account and issue the same login
  cookie. Missing providers have no routes. See OAUTH_SETUP.md for exact behavior,
  dependency risk, verified-email and no-auto-linking policy.
- DELETE /api/me accepts only currentPassword and requires the active user's
  password proof. Success is 204 and clears the cookie, but only when validated,
  immediate restrictive references protect projects, sessions and ledger_entries.
  Missing or unsafe protection returns 409 before deleting any identity data.
  Current core lacks those constraints: even empty accounts return 409 until the
  owners complete retention integration. With protection configured, retained
  resources also return 409 with full rollback, never a cascade. OAuth-only
  accounts cannot use this password reauthentication flow.

## Mail verification and password recovery additions

With mailSender configured, GET /api/auth/mail reports enabled=true, and these
routes are available (see MAIL_SETUP.md for the full contract):

- GET /api/me/email-status: authenticated current-email verification status.
- POST /api/me/email/verification: authenticated code request, 202.
- POST /api/me/email/verify: authenticated `{ code }`, 204.
- POST /api/auth/forgot-password: `{ email }`, generic 202 for eligible or
  ineligible addresses; no code is returned in JSON.
- POST /api/auth/reset-password: `{ code, newPassword }`, 204; revokes sessions,
  does not sign in. Invalid/expired/replayed codes return 400.

All mutations have the same Origin and bounded admission requirements. Verification
is optional and does not currently prevent sign-in. External delivery is not
implied by a 202 response; local development uses a disk outbox.

## In-process admin accounts

The identity factory now supplies `listAccounts`, `getAccount`, `setRole` and
`suspend` through `AdminAccounts`. Admin reads include suspended accounts and
return only AccountSummary fields; self-service GET /api/me is unchanged.
Missing reads return null. Mutations use exported AdminAccountFailure codes
account_not_found, invalid_role and invalid_suspension. Billing authorizes staff
and owns the HTTP translation. See ADMIN_HANDOFF.md for the full contract.

## In-process suspension

`createIdentitySlice(...).suspend(accountId, on)` is now available to trusted
admin callers. Billing must enforce staff authorization before calling it.
Suspension atomically deletes every login session; unsuspension requires fresh
login and does not restore old cookies. Session issuance locks and rechecks the
account's active state. Missing accounts reject with an error. No admin HTTP
endpoint or open-WebSocket disconnection is implemented by this operation.

## Failures

The current shared core serializes `{ error: string }`, a human-readable message.
Do not assume domain failure codes are transmitted. PR #6 proposes the different
nested `{ error: { code, message, field? } }` shape but has not implemented it.

- 400: invalid request body or account policy violation.
- 401: missing/invalid session, invalid password/current-password proof.
- 403: untrusted mutation Origin (not an identity role gate).
- 409: email already registered, or account changed since password proof.
- 413: request body exceeds the endpoint body limit.
- 429: local login admission/rate/concurrency limit.
- 500: unexpected database/infrastructure error; generic response, no details.

Signup intentionally exposes duplicate-email availability through 409. Password
login does not distinguish an unknown account from a wrong password. The exact
privacy policy and deployment-wide abuse controls remain owner decisions.

## Design-to-code mapping and remaining work

| Historical design | Current implementation |
|---|---|
| authStrategy.ts / AbstractAuthFlow | authFlow.ts / AbstractAuthFlow |
| ProductionAuthFlow | SessionAuthFlow |
| AccountRepo | PostgresAccountStore + PostgresAuthSessionStore via injected SQL |
| registerSessionVerifier / verifySessionCookie | existing core PrincipalResolver + SessionPrincipalResolver |
| POST /api/auth/login (password) | POST /api/auth/password |
| POST /api/auth/login (session) | no HTTP equivalent; SessionStrategy is used by request resolution |
| POST /api/auth/logout | POST /api/auth/signout |
| GET /api/auth/me and /api/account | GET /api/me returns account details |
| PATCH /api/account | PATCH /api/me |
| POST /api/account/password | POST /api/me/password |
| proposed error/message fields | core's current single error string |

Signup uses AccountService then AuthSessions.issue, not authenticate. Protected
reads and signout do not run the login template either. Password login does use
Strategy + Template Method with one shared session-issuance hook.

OAuth strategies/routes, AccountPanel and restricted password-account deletion
are implemented (OAUTH_SETUP.md). Real GitHub/Google local acceptance and Resend
verification-mail acceptance passed. Maintained OAuth library approval, real external
password reset, deployment abuse policy, canonical Settings mounting,
OAuth-only/retained-resource deletion, billing HTTP/UI integration and production
wiring remain pending. The in-process admin methods do not implement billing routes. See
PERSISTENCE.md for the migration/factory handoff and PLAN.md for the full backlog.
Do not overwrite the submitted design document without reconciling these changes
and the sprint estimate (its listed sprint allocations sum to 9.2, not 10.0).
