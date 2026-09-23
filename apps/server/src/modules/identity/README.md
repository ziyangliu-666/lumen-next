# identity — LU YI

UC1: password sign-up, sign-in and account management. Strategy with Template
Method varies credential verification while sharing session issuance. The
reviewed authentication core is retained rather than rewritten.

## Public index

`createIdentitySlice(options)` takes core's database, canonical origin, explicit
session lifetime and LoginGate, plus optional secureCookies, oauthProviders,
mailSender, mailKey and mailEvent. It returns `principalResolver`,
`registerRoutes`, the trusted account interface `listAccounts`, `getAccount`,
`setRole`, `suspend`, and, when a mailSender is given, `mailWorker`
(`MailWorker`: `start()`, `stop()`, `tick()`), which the composition root must
start and stop on shutdown. A mailSender requires a server-only mailKey of at
least 32 characters. `MailEvent` names the value-free delivery counters.
`oauthProvidersFromEnvironment(environment, origin)` constructs optional GitHub
and Google adapters from explicitly supplied server configuration, without
reading process.env or making network calls. Empty credential pairs disable a
provider; partial/malformed pairs fail with value-free errors. Enabled providers
require a canonical HTTPS origin by default and use fixed callback paths. An
explicit `{ allowLoopbackHttp: true }` third argument permits canonical loopback
HTTP for local acceptance only; production callers must not opt in. Core must inject
its result through oauthProviders; this export alone does not enable OAuth.
Billing must
call requireStaff before exposing account administration. No billing/admin HTTP
implementation is part of this slice.

`main.ts` mounts password routes and the cookie resolver whenever DATABASE_URL is
set. Stub headers then stop working for every slice. Database-free development
retains the stub; production without DATABASE_URL fails startup. The resolver
reads current role and suspension on every request, never renewing a session.

| Route | Behavior |
|---|---|
| POST /api/auth/signup | email, displayName, password; 201 and cookie |
| POST /api/auth/password | email, password; 200 and cookie |
| POST /api/auth/signout | revoke current token; 204 |
| POST /api/auth/signout-all | authenticated; revoke all account tokens; 204 |
| GET /api/me | authenticated public account |
| PATCH /api/me | displayName/email; password proof for email |
| POST /api/me/password | current/new password; revoke other sessions atomically |
| GET /api/auth/providers | configured providers; false by default |
| GET /api/auth/mail | enabled flag; false by default |

Account deletion is excluded pending shared retention constraints. main.ts wires
OAuth through oauthProvidersFromEnvironment; a provider is enabled only when its
credential pair is set. Mail verification and reset are written/tested but not
wired (Sprint 3). Mail requests are queued: a public request is one insert, and
MailWorker decides eligibility and delivers later, so response time no longer
depends on the address (see docs/identity/MAIL_QUEUE_DESIGN.md).

## Security and storage

Passwords use salted scrypt; only hashed random session tokens are stored.
Cookies are HttpOnly/SameSite=Lax/Secure by default. Insecure cookies require an
explicit loopback HTTP origin. Every identity mutation requires exact Origin.
LoginGate counts failed actions per direct peer and optional account key, bounds
tracked keys and concurrent work, and does not trust forwarded headers. It is
local, not distributed. New passwords have an 8-code-point minimum and a 1024-byte
ceiling. Signup's duplicate-email response still reveals availability.

PostgresAccountStore and PostgresAuthSessionStore use core's injected database.
Password changes compare the verified hash under account-first locking and
revoke all other sessions in the same transaction. Suspension similarly revokes
sessions and purges pending mail requests and codes; unsuspension restores neither. Existing WebSocket connections
retain their handshake principal until core provides revalidation.

Only core's migration runner applies 002/003/004/009. Migration 002 adds suspended
and normalized-email uniqueness to accounts; duplicate historical emails block
migration. No second migration tree or temporary runtime dependency exists.
Arctic is pinned at 3.7.0 and deprecated upstream; replace it before public OAuth
(docs/identity/ARCTIC_REVIEW.md).

## Design and acceptance

Without the pattern, each credential branch repeats verification/session code.
AuthStrategy encapsulates verification; AbstractAuthFlow fixes the sequence and
SessionAuthFlow supplies the shared completion. SessionStrategy resolves an
existing cookie but is not a minting strategy in the factory. Pattern unit tests
prove failure propagation, selection and shared completion without fallback.

SQL/HTTP/concurrency tests use openTestDb and TEST_DATABASE_URL from core. CI
supplies DATABASE_URL, so these tests run rather than skip. Tests include
multi-connection locks, rollback, auth isolation and pool-restart persistence.
`npm run verify` must pass with a real database, alongside build, staging smoke
and owner review. Local success is not merged delivery.

Track public acceptance scope and remaining work in
[delivery status](../../../../../docs/identity/DELIVERY.md).

See [API](../../../../../docs/identity/API.md),
[local setup](../../../../../docs/identity/LOCAL_AUTH.md),
[OAuth](../../../../../docs/identity/OAUTH_SETUP.md), and
[mail](../../../../../docs/identity/MAIL_SETUP.md).
