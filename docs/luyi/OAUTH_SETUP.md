# GitHub and Google OAuth implementation and setup

Checkpoint: 2026-09-18. Both providers have implemented strategies, adapters,
HTTP routes and sign-in controls. User-owned local clients and callbacks were
configured and exercised against both real providers on 2026-09-18; this is local
acceptance evidence, not approval of the deprecated dependency or production setup.

## Implemented code

- oauth.ts: Strategy implementations, transactional provider-account resolution,
  one-use server-side attempts bound to an independent HttpOnly browser cookie.
- oauthProviders.ts: GitHub and Google adapters over injected OAuth clients.
- oauthRoutes.ts: authorization redirects, callbacks, provider availability.
- createIdentitySlice: accepts optional oauthProviders and composes them with the
  existing Template Method; password and OAuth use the same session issuance hook.
- migrations/003_identity_oauth.sql: candidate table for pending attempts.
- SignIn.tsx: loads provider availability, enables only configured providers, sends
  users to the authorization endpoints and displays safe callback errors.

## Routes and behavior

| Route | Behavior |
|---|---|
| GET /api/auth/providers | `{ github: boolean, google: boolean }`; no secrets |
| GET /api/auth/github | Start GitHub authorization; 302 to provider |
| GET /api/auth/github/callback | Consume attempt, exchange code, resolve account, set session cookie |
| GET /api/auth/google | Start Google authorization with S256 PKCE |
| GET /api/auth/google/callback | Same completion flow using the stored verifier |

Unconfigured provider routes are not registered and their buttons stay disabled.
Successful callbacks go to /#/home for users or /#/admin for staff. Expected
failures go to /?authError=oauth_failed#/signin, or oauth_email_conflict for a
matching pre-existing email. Only fixed internal destinations/codes are used;
no provider error text or external returnTo is reflected.

Attempts expire after ten minutes and are deleted atomically before exchange.
The database stores hashes of state and browser binding; the Google verifier is
server-side and short-lived. Attempts survive process restart. The binding cookie
is HttpOnly, SameSite=Lax, callback-path scoped and Secure in HTTPS environments.
Callbacks require matching provider, state and browser cookie; replay, expired
attempts and denied consent issue no login cookie. Responses are no-store and
no-referrer. Expired attempts are purged on new authorization starts.

GitHub identity comes from its stable numeric user ID and a verified primary
email from /user/emails, not the public profile email. Google identity comes from
its stable sub and verified email at the authenticated userinfo endpoint; the
implementation does not decode and trust an unverified ID token. Provider access
tokens are not persisted or returned to the browser.

A new provider identity creates a user account transactionally. An existing
provider identity resolves its existing account/current role; suspension blocks
login. Same-email accounts are NEVER automatically merged, including when using
the other provider. Explicit account linking is a separate authenticated feature.
OAuth-only accounts have no password and cannot use password-based email change,
password change or account deletion until a separate reauthentication flow exists.

## Dependency warning: review required before production

Architecture names Arctic. On 2026-09-18, npm reports its latest release 3.7.0 as
**deprecated / no longer supported**, including several transitive dependencies.
It is installed ONLY under ignored tmp/identity-tools for local validation, not
added to package.json or the application lockfile. Core must approve continued
use or replace it with a maintained library behind the OAuthProvider seam.

The Arctic 3.7.0 Google client supports PKCE. Its GitHub client exposes state and
confidential-client code exchange but not PKCE. Do not claim GitHub PKCE is
implemented; evaluate a maintained client with GitHub PKCE before production.
Both token exchange and userinfo now have a ten-second application deadline;
userinfo also refuses redirects. The injected client does not expose cancellation,
so a timed-out exchange may continue inside the client until its own transport
ends. Retry behavior remains part of the reviewed library/client setup.

## Local setup (PowerShell, repository root)

Install the explicitly local tools and build:

```powershell
npm install --prefix ./tmp/identity-tools --no-package-lock --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8 arctic@3.7.0
npm run build
```

Create a GitHub OAuth App and a Google OAuth web client in your own accounts.
Register these exact local callback URLs:

```text
GitHub: http://localhost:4000/api/auth/github/callback
Google: http://localhost:4000/api/auth/google/callback
```

For Google configure the consent screen and add test users if the app is in
testing mode. Use a web application client, not a desktop client.

Set these environment variables privately before starting the local server:

```text
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

Do not paste secrets into chat, commit them, or put them into VITE_* variables.
The local process reads environment variables, not an automatically loaded .env.
A partially configured provider fails startup rather than advertising a broken
login. Each complete provider can be enabled independently.

```powershell
node apps/server/dist/modules/identity/localPglite.js
```

Open http://localhost:4000/#/signin. The local entry point applies the OAuth
candidate migration separately from the original local schema without resetting
existing accounts. It must be restarted after changing environment variables.
Do not run two processes against the same PGlite directory.

Production requires registered HTTPS callbacks matching the client construction,
core's approved dependencies/migrations, Secure cookies and the real PostgreSQL
adapter. Identity marks callback routes with Fastify's silent route log level so
the normal application request-completion log does not record code/state query
values. Reverse proxies and other upstream access logs must still redact callback
queries; identity's route setting and no-referrer response header cannot sanitize
them. Distributed rate limiting, expired-attempt cleanup scheduling and upstream
request-log redaction remain deployment review requirements.

## Test evidence

- Unit tests cover verified profile extraction, invalid email proof, fixed
  userinfo endpoints, error sanitization, bounded token exchange, Google verifier
  forwarding and Strategy.
- Optional actual-Arctic test verifies authorization URL/callback/state and
  Google S256 challenge generation without contacting providers.
- Optional PGlite HTTP tests cover both providers, repeat login, callback replay,
  missing/wrong binding/provider, expiry, cancellation, email conflict and roles.
  The external code exchange/profile responses are simulated in this suite.
- A supervised manual browser run on 2026-09-18 passed real GitHub and Google
  consent, first login, repeat login, user redirect and logout. Provider accounts
  remained distinct; rejected OAuth-only sensitive operations preserved the session;
  cross-tab signout, forged-staff rejection, invalid-state failure, no-store /
  no-referrer headers and a non-script-readable session cookie also passed.
  Parallel real Google starts safely produced one success and one oauth_failed while
  preserving the successful session. Origin/body-limit checks and local process
  restart persistence also passed. Real GitHub cancellation returned the fixed safe
  failure without a session. A temporary local staff promotion verified a real
  GitHub #/admin redirect and live staff role; the account was restored to user.
  A backed-up temporary database state then made the real Google exchange/profile
  collide with an existing password account: oauth_email_conflict appeared without a
  session or automatic link. The original database was restored and Google login
  passed again. Credentials stayed in the local process and were not added to the
  repository.

```powershell
$env:IDENTITY_PGLITE_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/@electric-sql/pglite/dist/index.js'
$env:IDENTITY_ARCTIC_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/arctic/dist/index.js'
npm run verify
Remove-Item Env:IDENTITY_PGLITE_MODULE
Remove-Item Env:IDENTITY_ARCTIC_MODULE
```

## Account self-service added in this increment

AccountPanel.tsx supplies profile/password changes, signout-one/all and guarded
password-account deletion. It is currently reachable through "Manage signed-in
account" on #/signin, without editing another owner's Settings folder. Shell
should mount/rehome this component through an owner-reviewed composition change;
pages must not add unreviewed cross-page imports.

DELETE /api/me accepts only `{ currentPassword }`. It locks/rechecks the credential
and deletes the account's sessions/credentials/account in one transaction. Existing
project/ledger foreign keys block deletion with 409 and roll back all changes.
There is no cascade of another slice's data. Wrong proof returns 401; unexpected
body fields return 400. OAuth-only deletion and deletion with retained resources
remain unavailable pending provider reauthentication and retention agreements.

Browser checks against the real PGlite server covered registration, profile edit,
password change, password-field clearing and deletion of the disposable test
account, followed by GET /api/me returning 401. Email verification/reset codes,
RecoveryPanel, the local outbox and an optional HTTP mail transport are now also
implemented; see MAIL_SETUP.md. Provider-verified email does not automatically
populate the application's separate verification record.

Latest full verify with both external local tools enabled: 306 tests pass,
87.97% line coverage. The supervised real-provider success paths above passed;
remaining OAuth cases and external delivery are still not validated.
