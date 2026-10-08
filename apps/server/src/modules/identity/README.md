# identity — LU YI

UC1: password sign-up, sign-in and account management. Strategy with Template
Method varies credential verification while sharing session issuance. The
reviewed authentication core is retained rather than rewritten.

## Public index

`createIdentitySlice(options)` takes core's database, canonical origin, explicit
session lifetime and LoginGate, plus optional secureCookies, oauthProviders,
mailSender, mailKey, mailEvent and core's `log`. It returns `principalResolver`,
`registerRoutes`, the trusted account interface `listAccounts`, `getAccount`,
`setRole`, `suspend`, the account eligibility check `canSpend(accountId)`
(true only for an account that exists, is not suspended and is not deleted;
false for an unknown or malformed id; a storage error rejects), which the
composition root hands billing's AccountHandler, and, when a mailSender is given, `mailWorker`
(`MailWorker`: `start()`, `stop()`, `tick()`), which the composition root must
start and stop on shutdown. A mailSender requires a server-only mailKey of at
least 32 characters. `MailEvent` names the value-free delivery counters.
`mailFromEnvironment(environment, { outboxDirectory, production, origin })` builds the
optional mail configuration from explicitly supplied variables.
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
| DELETE /api/me | reauthenticate, tombstone the account, revoke all sessions; 204, cookie cleared |
| GET /api/auth/providers | configured providers; false by default |
| GET /api/auth/mail | enabled flag; false by default |

Account deletion (`DELETE /api/me`, AccountService.deleteAccount) is immediate
and irreversible, and only the user can do it. Reauthentication is the current
password; an account without one must have signed in within the last 10 minutes
(RECENT_SIGN_IN_MS) on the requesting session. The accounts row stays as a
tombstone (`deleted+<id>@invalid`, "Deleted account", role user, suspended,
deleted_at set) so other slices' rows keep a valid id; identity deletes the
credentials (password and OAuth), sessions, mail codes, verified addresses and
queued mail in the same transaction. Admin methods treat a tombstone as not
found, and migration 010 keeps it suspended. See
[API](../../../../../docs/identity/API.md#account-deletion). main.ts wires
OAuth through oauthProvidersFromEnvironment; a provider is enabled only when its
credential pair is set. main.ts enables mail verification and reset only when
`mailFromEnvironment` returns a configuration (IDENTITY_MAIL_MODE outbox or
resend, plus IDENTITY_MAIL_KEY); it is off by default. Mail requests are queued: public reset admission uses the same database operations
for every well-formed address, without account lookup or transport calls. MailWorker
checks eligibility and delivers asynchronously (see docs/identity/MAIL_QUEUE_DESIGN.md).

## Security and storage

Passwords use salted scrypt; only hashed random session tokens are stored.
Cookies are HttpOnly/SameSite=Lax/Secure by default. Insecure cookies require an
explicit loopback HTTP origin. Every identity mutation requires exact Origin.
LoginGate counts failed actions per account key (5 a minute) when a request names
one, and per direct peer (100 a minute) only when it does not, so one failing
client behind a shared proxy locks out no other user. It bounds tracked keys,
queues work beyond 4 concurrent actions (refusing only past 64 waiting), and does
not trust forwarded headers. It is local, not distributed. New passwords have an 8-code-point minimum and a 1024-byte
ceiling. Signup's duplicate-email response still reveals availability.

The slice logs through `log.child({ slice: 'identity' })` (docs/LOGGING.md): a
warn line with a fixed `action` and `reason` when a sign-in or an account action
is refused or rate-limited, and one line per mail event (info for admitted and
sent, warn for dropped, retry and ineligible, error for failed and error). A line
never carries an address, a password, a code, a token or provider text.

PostgresAccountStore and PostgresAuthSessionStore use core's injected database.
Password changes compare the verified hash under account-first locking and
revoke all other sessions in the same transaction. Suspension similarly revokes
sessions and purges pending mail requests and codes; unsuspension restores neither. Existing WebSocket connections
retain their handshake principal until core provides revalidation.

Only core's migration runner applies 002/003/004/009/010. Migration 010 adds
`accounts.deleted_at` and a tombstone-stays-suspended check to the shared
accounts table. Migration 002 adds suspended
and normalized-email uniqueness to accounts; duplicate historical emails block
migration. No second migration tree or temporary runtime dependency exists.
GitHub and Google use the in-slice clients in `oauthClients.ts` (native fetch, no
OAuth library); the deprecated `arctic` dependency has been removed.

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

### Account lifecycle integration (not activated)

`withActiveAccount(accountId, work)` owns a transaction and locks an active,
non-deleted account before awaiting `work(transaction)`. It is a trusted
serialization port, not HTTP authentication. Consumers must use that transaction
for their queries, never the pool or a nested transaction. Ineligibility and
storage/commit failures reject; `canSpend` remains an unlocked snapshot.

The optional `onAccountDeleting(accountId, transaction)` factory dependency runs
under the same account lock after deletion proof succeeds. It must be awaited;
any failure rolls back cleanup and identity deletion. No consumer is wired by
default, and Billing Keys remains disabled. Composition must inject Billing's
keyring-independent cleanup and require lifecycle wiring before enabling saves.
The optional `removeOwnOpenAiKey(accountId, transaction)` callback enables
`POST /api/auth/key-removal/openai/password` with fresh bounded password proof,
and POST-confirmed GitHub/Google removal through purpose-separated OAuth attempts.
These allow a suspended, non-deleted owner to remove only their own OpenAI key,
without normal login, account linking or session issuance. The callback must
only erase that owner's OpenAI ciphertext using the supplied transaction.
OAuth callbacks consume the attempt before exchange; a failed action requires a
new attempt. No callback is configured by the existing composition, so these
routes are not enabled in the running app. See
[key lifecycle agreement](../../../../../docs/identity/KEY_LIFECYCLE.md) for
lock ordering, endpoint details, tests and the remaining owner handoff.

### Acceptance status

Identity delivery PRs #23, #34, #37, #38, #40 and #47–#51 are merged. The PM
confirmed GitHub/Google sign-in through Account on 3 October in PR #38. Real
password-reset mailbox acceptance remains unconfirmed. A PostgreSQL test with a
simulated sender, local outbox file or provider response is not inbox acceptance.

Track public acceptance scope and remaining work in
[delivery status](../../../../../docs/identity/DELIVERY.md).

See [API](../../../../../docs/identity/API.md),
[local setup](../../../../../docs/identity/LOCAL_AUTH.md),
[OAuth](../../../../../docs/identity/OAUTH_SETUP.md), and
[mail](../../../../../docs/identity/MAIL_SETUP.md).
