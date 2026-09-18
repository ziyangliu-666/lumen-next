# Local identity with PGlite

This development-only entry point serves the built web app and real identity
endpoints on one loopback origin. It uses the existing PostgreSQL stores,
not mocks or SQLite. Accounts and login sessions persist on disk.

It does **not** modify production main.ts or register the other slices. OAuth is
implemented but requires provider configuration; see OAUTH_SETUP.md. AccountPanel
is available inside signin, not yet mounted in the canonical Settings tab.
The home page is the existing shell;
a successful redirect is not evidence that project/session features work. All
WebSocket session access is denied in this identity-only harness.

## Setup and start

Run from the repository root (PowerShell or a terminal):

```sh
npm install --prefix ./tmp/identity-tools --no-package-lock --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
npm run build
node apps/server/dist/modules/identity/localPglite.js
```

Open **http://localhost:4000/#/signin**. Choose "New here? Create an account".
Use a test email, name and a password of at least 15 Unicode code points. No
predefined account, seed password or automatic staff grant exists.

Use the exact localhost URL, not 127.0.0.1 or Vite's port 4173: mutating requests
must have Origin http://localhost:4000. The server binds only to 127.0.0.1. Local
cookies are HttpOnly, SameSite=Lax and deliberately non-Secure for loopback HTTP.
The session lasts 24 hours; expensive operations are limited to 5 per minute per
peer. Wait a minute after repeated submissions rather than disabling the guard.

Stop with Ctrl+C. Rebuild after source changes. Do not run the normal server on
port 4000 at the same time. NODE_ENV=production refuses this entry point.

## Data and isolation

- Tool installation: tmp/identity-tools, outside application dependencies.
- Database: tmp/identity-local-db, excluded by the existing /tmp/ gitignore rule.
- Process lock: tmp/identity-local-db.lock. A second local process refuses startup.
- Only this local fixture bootstrap applies the base schema and identity candidate
  SQL once, transactionally. OAuth migration 003 has its own fixture fingerprint
  and is applied separately without resetting accounts. Persisted fingerprints reject changed schemas.
  This is not a replacement for core's production migration runner.
- After an abnormal termination, confirm the old process is gone before manually
  removing the empty lock directory. Never remove a live process's lock.
- To reset local accounts, stop the server, back up anything needed, and explicitly
  remove tmp/identity-local-db. Startup never resets existing data automatically.
- Test suites use separate disposable databases and never truncate this directory.

Use disposable credentials only. Do not commit/copy this database to deployment.

## Local staff account and role checks

Register a separate disposable account through the normal signup page first.
Stop the local server, then explicitly promote that account at startup:

```powershell
$env:LOCAL_IDENTITY_STAFF_EMAIL = 'your-local-staff@example.test'
node apps/server/dist/modules/identity/localPglite.js
# After stopping the server:
Remove-Item Env:LOCAL_IDENTITY_STAFF_EMAIL
```

This affects only the fixed local PGlite database. It refuses missing/suspended
accounts, never creates a default password and is not an HTTP promotion endpoint.
The role persists; future starts do not need the variable. Do not use this as a
production provisioning mechanism.

Both roles sign in on the same page. Staff redirects to #/admin; members redirect
to #/home. The local-only GET /api/local/staff-check uses core's requireStaff:
anonymous = 401, member = 403, staff = 200. It is not exported by identity or
mounted by production main.ts. It does not stand in for billing's admin APIs.

Role acceptance checked on 2026-09-18:

- Real browser signup defaults to user, including the future staff test account.
- After explicit promotion and a server process restart, the persisted cookie
  resolves the current staff role. Fresh password login redirects to #/admin;
  the probe returns 200 before and after browser refresh.
- A real member login redirects to #/home. The probe returns 403, including when
  a forged Authorization: stub forged:staff header accompanies the member cookie.
  After signout the probe returns 401.
- SQL/HTTP integration tests verify client-supplied signup/profile roles are
  rejected, promotion/demotion affects existing cookies, suspended users cannot
  sign in or use existing cookies, account updates stay isolated, and staff
  signout-all invalidates both staff sessions without logging out another member.

Known gaps (not claimed as passing):

- The shared router permits a member to navigate directly to #/admin and see the
  static placeholder table. No real admin data is loaded there, but a reviewed
  shell/billing route guard is still required. Do not confuse API authorization
  with front-end navigation protection.
- Billing's real admin account endpoints are not implemented by this harness.
  The identity factory now exposes listAccounts/getAccount/setRole/suspend for
  trusted in-process callers; billing must apply requireStaff before invoking
  them. SQL/HTTP tests exercise these methods, not billing management endpoints.
  See ADMIN_HANDOFF.md for integration details.
- Suspension now atomically deletes every login session. Unsuspending never
  restores old cookies: password login is required again. Tests cover multiple
  sessions, unrelated accounts, blocked issuance and rollback on deletion failure.
  Already-open WebSocket disconnection remains a separate integration task.

## OAuth, account settings and recovery

On #/signin, "Manage signed-in account" opens AccountPanel for profile/password
changes, signout and restricted password-account deletion. "Forgot password /
email verification" opens RecoveryPanel. The canonical Settings tab still needs
a reviewed shell integration.

The local process enables mail with a disk outbox at tmp/identity-mail-outbox.
Messages contain one-use codes for pasting into RecoveryPanel; do not publish the
folder. See MAIL_SETUP.md for external delivery opt-in. OAuth buttons stay disabled
until the provider credentials are configured; see OAUTH_SETUP.md. Candidate
migration 004 is bootstrapped separately alongside 003 without resetting accounts.

## Database tests

Enable the optional engine tests in PowerShell:

```powershell
$env:IDENTITY_PGLITE_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/@electric-sql/pglite/dist/index.js'
npm run verify
Remove-Item Env:IDENTITY_PGLITE_MODULE
```

The 17 original engine tests cover account/role/deletion operations; 12 additional
OAuth/mail engine tests cover provider callbacks and email-code lifecycle. The disk
restart test and five steering-boundary tests bring the PGlite-optional total to
35. One separate real-Arctic URL/PKCE test requires IDENTITY_ARCTIC_MODULE (see
OAUTH_SETUP.md). Without both external tools, 36 tests are explicitly skipped.

Validation on 2026-09-18: build and full verify passed with both tools enabled,
306 tests passing, 87.97% line coverage (the standalone bootstrap is included in
the coverage denominator but is exercised manually, not by Vitest). Browser
checks against the real local server confirmed signup, GET /api/me, signout,
401 after signout, password login and an authenticated page reload. No API
interception/mocking was used. Engine reopen and a local server process restart
were checked; production multi-process PostgreSQL concurrency is not.

## PostgreSQL deployment handoff

Keep createIdentitySlice and the PostgreSQL stores. Core must provide a real pg
pool adapter implementing IdentityDatabase, apply reviewed migrations with the
shared runner, and wire the slice resolver/routes into main.ts. Set the actual
HTTPS origin and Secure cookies; never fall back to this local entry point.
See PERSISTENCE.md for the transaction contract and production acceptance list.
Neither PostgreSQL deployment wiring nor migration of local test data is performed
by these commands. PGlite testing does not replace PostgreSQL 17 driver,
concurrency, migration and cross-slice acceptance tests.
