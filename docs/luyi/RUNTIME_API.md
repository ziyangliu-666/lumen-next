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

OAuth strategies/routes, verification/reset email and token lifecycle, Account
settings UI, deletion, billing account services and production wiring are still
pending. The schema's provider columns are not an OAuth implementation. See
PERSISTENCE.md for the migration/factory handoff and PLAN.md for the full backlog.
Do not overwrite the submitted design document without reconciling these changes
and the sprint estimate (its listed sprint allocations sum to 9.2, not 10.0).
