# LU YI: resume here next session

Updated: 2026-09-18 after real verification-mail acceptance and parallel PR review. User request: preserve unfinished tasks and
continue implementing them next session, not merely produce more design documents.
This file is a handoff/checklist, not a background job or an automatic login hook.

## Latest checkpoint: 2026-09-18, user-requested eight-character passwords

- LU YI asked whether the 15-character rule was required and requested a shorter
  rule if it was locally chosen. PLAN.md recorded it as a provisional local
  implementation decision, not an agreed shared contract. Changed the new-password
  minimum to **8 Unicode code points**, retaining the 1024 UTF-8 byte maximum,
  whitespace/Unicode preservation, hashing and existing-password login behavior.
  Password-only production security review remains pending; no NIST compliance
  claim is made for the lowered minimum.
- Signup, account password change and recovery frontend checks/messages now match
  the shared backend validator. Boundary tests first failed against the old rule;
  tests now cover 7/8, 8-15, longer passwords, Unicode, and byte ceilings. Real
  SQL/HTTP signup/login and reset tests use synthetic eight-character passwords.
- Full verify: **405 passed, zero skipped**, 90.81% lines; build passed.
- The user's manual site is at http://127.0.0.1:4001/#/signin, with a separate native
  PostgreSQL cluster on 55433 under ignored tmp/identity-manual-pg. Core HTTP and
  Db, node-pg-migrate with local combined candidate migrations, identity and session
  are composed by an ignored workstation helper, not production main.ts. OAuth/
  mail are disabled and deletion remains safely refused. Existing private PGlite
  data is untouched. The manual cluster was stopped cleanly and restarted on the
  same directory to load this change; no account reset or password inspection.
- Health and served eight-character UI text were checked after restart. The user
  performs their own registration/login; do not read their password, cookie or
  private local database configuration. Browser manual acceptance is still pending.

## Earlier checkpoint: 2026-09-18, retention regression safely contained

- Fixed the three deletion regressions inside identity only. AccountDeletion now
  requires validated, immediate restrictive account references for projects,
  sessions and ledger_entries, with no competing destructive foreign key.
  It reads PostgreSQL metadata, not another slice's business rows. A conservative
  account-table lock precedes row locks and remains held through the transaction
  to serialize deletion against relevant DDL and account writes.
- The current core schema does not meet that capability check: all password-account
  deletion (including empty accounts) returns 409 without removing credentials,
  login sessions or accounts. This is intentional fail-closed behavior, NOT a
  completed production retention integration. Owners must review migrations,
  stub-ID reconciliation and lock contention before enabling normal deletion.
- The original three assertions remain and pass. Five additional native-pg cases
  reject missing/cascade/competing-cascade/unvalidated/deferred protection. Existing
  empty-account success/issuance-race cases now explicitly use restrictive DDL
  fixtures in disposable test schemas; no production migration was added. Native
  retained-resource cases also exercise rollback with those test constraints.
- Four new default-CI unit tests verify the gate rejects absent/false/non-boolean
  capability results without writes and allows writes only after positive proof.
- Merged-base full verify: **394 passed, zero skipped**, 90.81% lines. Default:
  **315 passed / 79 skipped**, 71.04% lines. Build passes. Temporary database/schema
  cleanup and shutdown confirmed. This supersedes the 382/3 failure result below.
- Personal Draft PR #1 exists at https://github.com/youayouly/lumen-next/pull/1.
  Publish this fix only to mine/identity/auth-flow and keep the PR draft. No team
  branch/main write or deployment. Core/Settings/OAuth/mail/WS integration and
  production-retention approvals remain unfinished.

## Earlier checkpoint: 2026-09-18, latest-main regression (BLOCKED)

- User authorized latest-main testing and personal-repository publication only.
  Merged `origin/main` at `e3937d4` in `628f897`, without textual conflicts.
  Installed the upstream lockfile with npm ci; no new dependency choice was made.
- Adapted identity's local harness and five SQL suites to read only the Up section
  of core's `001_core_base.sql` through `localSchema.ts`. The Down section must
  never be executed by a fixture. Production still uses core's migration runner.
- Full merged-base verify with real PostgreSQL, PGlite and Arctic:
  **382 passed, 3 FAILED, zero skipped (385 total)**. Formatting, lint and
  typecheck passed; workspace build passed. Default verify without optional
  databases/tools: **311 passed / 74 skipped**, 70.1% lines. Default green is NOT
  release evidence: it skips all three failing retention checks.
- BLOCKER: current core deliberately declares `ledger_entries.account_id` and
  `sessions.account_id` as text without account foreign keys. AccountDeletion
  relies on restrictive references, so it currently deletes accounts with retained
  ledger/session records. The existing WASM ledger HTTP test returns 204 instead
  of 409; two added native-pg regressions reproduce ledger and session deletion.
  Expected assertions were preserved; no skipping or success-expectation change.
- Core/billing/session owner decision needed: reviewed restrictive FK migrations
  and reconciliation of stub-era IDs, or an explicit retention/worker-stop policy
  port with a safe default. Do not add cross-slice SQL checks or change shared
  schema silently. Until resolved, do not expose account deletion or mark ready
  for merge/deployment. No production endpoint was mounted by this merge.
- Existing disk-backed PGlite data was not opened, reset or migrated. Its old
  bootstrap fingerprint will intentionally reject the new schema. Back up and
  obtain explicit migration/reset approval rather than deleting that database.
- Publication target remains `youayouly/lumen-next:identity/auth-flow`; no team
  branch/PR/main write or deployment is authorized. Preserve this known failing
  result prominently in any Draft PR. Previous 339/339 and 18/18 results below
  describe the old base and must not be presented as current-base acceptance.
- Personal GitHub Actions is enabled. CI triggers on main pushes or PRs, not
  identity branch pushes. Copilot workflow requests review only for non-draft PRs
  and requires COPILOT_REVIEW_TOKEN; no repository-level secret was listed.
  Copilot subscription/ruleset status was not established (ruleset API returned
  403 for the private repo). Do not claim Copilot or CI ran on this branch.

## Earlier PR preparation checkpoint: 2026-09-18

- Refreshed origin and mine. Team main is now `e3937d4`, six commits beyond
  the previously integrated base. `git merge-tree --write-tree HEAD origin/main`
  succeeded without textual conflicts; no merge or rebase was performed.
- IMPORTANT: the 339-test result below is for the identity branch before these
  upstream changes. Core moved `core/db/schema.sql` to the migration directory;
  identity's local harness and five engine suites still reference the removed
  path. Session/wire behavior also changed. Reconcile within identity and rerun
  the combined checks after integrating main; do not claim latest-main compatibility.
- GitHub reports the personal repository has no parent (it is not a fork).
  Team-main PR creation therefore requires an explicitly approved source branch
  in the team repository, or another approved fork/publication arrangement.
  Current authorization is publication to `mine/identity/auth-flow` only.
- Commit the four reviewed test/documentation files and publish the pending local
  commits to that personal branch. Prepare an English Draft PR body with scope,
  validation provenance, upstream compatibility warning and remaining blockers.
  No team branch write, PR creation, merge or deployment is authorized by this note.

## Earlier checkpoint: 2026-09-18, expanded concurrency and restart acceptance

- Expanded `postgresLive.test.ts` from seven to **18 passing real-pg tests**:
  concurrent OAuth identity/account resolution without automatic linking, one-use
  OAuth state/reset, reset vs issuance in both lock orders, reset vs suspension,
  deletion vs issuance/suspension, and real deferred-constraint COMMIT failure.
  No application behavior or policy changed; these tests passed existing code.
- Combined verify: **339 passed, zero skips**, 88.53% lines; build passed. This
  includes PGlite, Arctic and native PostgreSQL 17.10 / pg 8.23.0 acceptance.
- Separate local smoke check passed a real PostgreSQL stop/start (different server
  PID, same data directory): account and active session persisted, revoked session
  stayed revoked, and new suspension invalidated the remaining session. This is
  not an application restart or crash-recovery test and is outside the Vitest count.
- Rerun after build: `node tmp/identity-pg-tools/dist/run-identity-live-pg.mjs restart`.
  The ignored helper was corrected for inherited Windows pg_ctl stdio handles
  after timed-out attempts; identified test clusters were stopped safely. The
  final run confirmed schema cleanup and clean shutdown. See PERSISTENCE.md.
- Remaining independent database acceptance: transport loss/ambiguous COMMIT,
  rollback transport failure, crash recovery and additional race permutations.
  Core's runner/production mounting, Settings, live reset mail and OAuth dependency
  approval are still blocked on their existing owner/input requirements.
- All changes remain local/uncommitted. No production dependencies, cross-slice
  implementation, push or deployment were added.

## Earlier checkpoint: 2026-09-18, first real PostgreSQL acceptance

- User requested provisioning of the missing independent database/driver.
  Installed native PostgreSQL 17.10 binaries via embedded-postgres and pg 8.23.0
  only in ignored `tmp/identity-pg-tools`; application manifests/lockfile unchanged.
- Ran the seven live-pg tests successfully against a fresh loopback-only cluster,
  with a non-superuser database owner and randomly generated SCRAM credentials.
  Observed actual multi-connection lock waits; this is no longer WASM-only evidence.
- Combined `npm run verify` with PGlite, Arctic and real pg: **328 passed, zero
  skipped**, 88.15% line coverage. Schema cleanup confirmed; cluster stopped cleanly
  and no listener remains on 55432. No service/autostart was installed.
- Local rerun helper: `node tmp/identity-pg-tools/dist/run-identity-live-pg.mjs`;
  add `verify` to run the quality gate. See PERSISTENCE.md for isolation and setup.
- Still pending: server restart persistence, OAuth/reset/deletion races and
  transport/COMMIT failure acceptance, core's real migration runner/production
  mounting, Settings integration, provider approval and real password-reset mail.
  The seven tests do not complete all P3 requirements. Changes remain uncommitted;
  nothing was pushed or deployed.

## Earlier checkpoint: 2026-09-18, PostgreSQL test preparation

- Added `postgresLive.test.ts`: seven opt-in real-pg tests for driver/schema
  isolation, concurrent signup/password changes, rollback-only handling and
  deterministic lock races around suspension/password-proof session issuance.
- This is test preparation, **not live PostgreSQL acceptance**. No Docker/psql/
  postgres command or listener on 5432 was detected during this continuation.
  Supply an external pg module and a disposable test database as described in
  PERSISTENCE.md. No production dependency or other owner's code was changed.
- No listener on port 4000 was detected either. Do not assume the previous local
  OAuth/mail process or its private credentials survived. Restart using the
  documented local setup only when needed; never expose credentials in chat.
- Validation: default verify 282 passed / 46 skipped; PGlite + Arctic verify
  321 passed / 7 live-pg tests skipped, 88.15% lines; workspace build passed.
  Partial live-pg configuration was deliberately tested and failed before import
  or connection, rather than silently skipping. No live mail/provider check ran.
- Changes remain local and uncommitted; no push/PR/deployment was performed.
  Next action is to run the seven tests against a disposable PostgreSQL instance,
  not to mark the P3 acceptance checkbox complete. Other owner/policy blockers
  below remain unchanged.

## First actions

1. Read CLAUDE.md and its required references, then this file, CONTEXT.md,
   the identity README and RUNTIME_API.md. Check actual code before relying on
   older design/submission status. This checkpoint supersedes older progress text.
2. Inspect git status and current branch. Local server implementation is committed
   as 46fa9c2 and signin UI as e06a654 on identity/auth-flow; the review/acceptance
   documentation follows in its own commit. These commits are **not pushed**.
   Preserve any later changes; do not reset, clean or overwrite from a remote.
3. Check the local process/port before starting anything. At handoff the local
   PGlite harness was running on http://localhost:4000/#/signin. Do not stop an
   unrelated process or run two engines on the same database directory.
4. Resume the first unblocked task below. Ask only for missing credentials,
   required policy decisions or owner approvals; do not ask the user to restate
   this backlog. Record actual outcomes and remaining blockers in this file.
5. Keep changes in identity and its signin page unless the relevant owner has
   approved a shared/settings change. Never claim a document/test fixture is a
   completed integration, live provider login, real email or reviewed deployment.

## Already implemented: do not rebuild

- Password signup/login; current/all-session signout; cookie resolver; /api/me;
  profile/password changes, hashing, Origin checks and bounded local admission.
- PostgreSQL stores, createIdentitySlice, public IdentityAuthentication and
  AdminAccounts surfaces. listAccounts/getAccount/setRole/suspend are executable.
- Suspension atomically deletes all login sessions; unsuspension requires login.
- Local disk-backed PGlite bootstrap, restart tests and local role probe.
- GitHub/Google OAuth strategies/adapters/routes, one-use state/browser binding,
  Google PKCE, provider availability UI, no automatic same-email account linking.
- AccountPanel: profile/password changes, signout and restricted password-account
  deletion. Projects/ledger references block deletion with transactional rollback.
- RecoveryPanel: email verification and forgot/reset flows. Expiring one-use
  hashed codes; password reset revokes all sessions. Local disk mail outbox and
  injectable MailSender / optional Resend adapter are implemented.
- postgresDatabase(pool): actual adapter code for core's supplied pg pool,
  transaction/rollback/release tests. No private pool or production runner.
- Public-index integration with real session code, steering boundary fixtures,
  owner handoffs and documented open-socket revocation gap.

## Remaining tasks, in execution order

### P0: OAuth release dependency decision and real provider acceptance

- [ ] Resolve the OAuth client dependency with LIU ZIYANG. Parallel review recommends
  evaluating openid-client (not approved or installed); see PR_READINESS.md. Architecture names
  Arctic, but npm marks latest 3.7.0 deprecated/unmaintained. It is only installed
  in ignored tmp/identity-tools, NOT the production package/lockfile. Prefer a
  maintained client after approval; preserve the injected OAuthProvider seam.
- [ ] Review GitHub PKCE support. Current Arctic GitHub client lacks PKCE; Google
  S256 PKCE is implemented/tested. Do not advertise GitHub PKCE as complete.
- [x] User privately configured GitHub and Google OAuth apps on 2026-09-18.
  Credentials were entered into the local process prompt, not chat, Git or VITE_*.
- [x] Registered exact local callbacks:
  http://localhost:4000/api/auth/github/callback and
  http://localhost:4000/api/auth/google/callback. Google is external/testing and
  the user-controlled account is present as a test user.
- [x] Completed both real-provider acceptance on 2026-09-18. GitHub and Google
  consent/first login, repeat login, user redirect and logout passed; /api/me returned
  the expected user account and no browser console warnings/errors appeared.
  Additional checks passed: distinct provider accounts, rejected OAuth-only sensitive
  operations, cross-tab signout, forged-staff rejection, invalid state, no-store /
  no-referrer and a non-script-readable session cookie. Real GitHub cancellation
  returned oauth_failed without a session. Temporary staff promotion produced a real
  GitHub #/admin redirect and was restored to user. Against a backed-up temporary
  database state, real Google exchange/profile hit oauth_email_conflict without a
  session or automatic linking; the original database was then restored and Google
  login passed again. Credentials remain only in the running local process.
  Two real Google starts issued in parallel produced one successful login and one
  fixed oauth_failed result; the successful shared session remained valid. Missing
  and foreign Origin requests returned 403, oversized identity input returned 413,
  and the existing OAuth session survived a full local process/database restart.
- [ ] Before deployment: approved dependency installation and HTTPS callback
  config. A ten-second application deadline now bounds token exchange and userinfo;
  callback routes suppress Fastify's URL-bearing request log. The approved client
  still needs transport cancellation/retry review, and upstream proxy/access logs
  must redact callback code/state queries.

References: OAUTH_SETUP.md, oauth*.ts, localOAuth.ts. Credentials/dependency approval
are blockers for live acceptance, not grounds to fabricate success.

### P1: real mail acceptance and recovery hardening

- [x] Configured Resend for local acceptance with a privately entered server key
  and its test sender. This is not production provider/domain approval.
- [x] Real verification email was received and submitted by the user. The lead
  independently confirmed GET /api/me/email-status returned 200, verified=true.
- [ ] Real password-reset delivery and manual submission remain pending: use a
  user-controlled password-based test account eligible for the Resend sender.
  The current OAuth-only account is not eligible. Never convert/link that account
  or read/submit the user's password/code to force acceptance.
- [ ] Approve a production provider and verified sender. Local default remains
  outbox; explicit external opt-in uses IDENTITY_MAIL_MODE=resend, RESEND_API_KEY
  and MAIL_FROM. A 202 response alone is never proof of delivery.
- [ ] Decide whether verified email is required before normal use. Currently it
  is optional, requested manually, and OAuth proof does not populate the app's
  separate verification record. Implement only the agreed policy.
- [ ] Decide whether suspension revokes pending recovery proofs as well as login
  sessions. Currently codes cannot be used while suspended, but an unexpired code
  can be used after unsuspension. Old login sessions still never return.
- [ ] Production delivery/abuse review: durable queue/retry if required,
  per-account/distributed limits, scheduled expired-code cleanup, bounce handling
  and enumeration policy. Generic forgot responses do NOT guarantee equal timing
  because delivery currently runs inline. Do not claim enumeration resistance.
- [ ] Confirm whether billing needs approval/invitation notification templates.
  These are not supplied by the verification/reset templates today.

References: MAIL_SETUP.md, mail*.ts, RecoveryPanel.tsx. Codes are not in URLs;
local outbox contains secrets and must stay untracked/unpublished.

### P2: Account completion within agreed ownership

- [ ] Coordinate with HE RONG/LIU ZIYANG to mount/rehome AccountPanel in canonical
  Settings. It currently works from "Manage signed-in account" on #/signin.
  Settings folder belongs to billing; do not add an unreviewed cross-page import.
- [ ] Implement OAuth-only sensitive-operation reauthentication and explicit
  connected-provider link/unlink if approved. Currently provider-only accounts
  cannot change email/password or delete via the password-proof flow. Never link
  accounts solely because email strings match.
- [ ] Agree retention/worker-stop semantics before deleting accounts that own
  projects or ledger data. Current delete safely returns 409 without cascading.
- [ ] Agree last-active-staff/self-demotion/deletion and audit policies with
  billing. Current account admin methods are trusted primitives, not those policies.
- [ ] Review whether ordinary password CHANGE should revoke all sessions too.
  Currently ordinary change retains sessions; RESET and suspension revoke them.

### P3: shared integration requiring owner review

- [ ] LIU ZIYANG: mount identity in production main.ts, remove stub fallback,
  supply shared pg pool through postgresDatabase(pool), assign migration numbers
  and run reviewed migrations 002/003/004 through core's runner.
- [x] Prepare an isolated opt-in pg suite for driver/schema checks, concurrent
  signup/password changes, rollback-only behavior and observed multi-connection
  lock races. Implemented and passed against native PostgreSQL 17.10 / pg 8.23.0
  on 2026-09-18 (seven tests; see latest checkpoint).
- [x] Extend native PostgreSQL acceptance to OAuth/state/reset/deletion races and
  deferred-constraint COMMIT failure (18 tests), plus a separate clean server
  stop/start persistence smoke check. Passed on 2026-09-18; see latest checkpoint.
- [ ] Finish disposable PostgreSQL failure acceptance: transport loss, ambiguous
  COMMIT, rollback transport failure, crash recovery and additional lock-order
  permutations. Repeat through core's reviewed pool/runner and application startup
  before deployment. Current tests are not production integration.
- [ ] LIU ZIYANG: shared frontend /api/me login state, cache invalidation on
  signout/account switch and a real #/admin route guard. Member navigation still
  reaches the static admin placeholder, although protected APIs reject members.
- [ ] Core + session + steering: close/revalidate already-open WebSockets on
  signout, expiry, suspension, password reset and role changes, including outbound
  subscriptions. Current socket principal is captured at handshake; account-only
  rechecks cannot detect single-session signout. Define multi-process semantics.
- [ ] Core: exact allowed-Origin policy for WS; trusted proxy/rate policy; ensure
  other slices protect their own mutations (identity's Origin hook is encapsulated).
- [ ] PENG XUJIAN + LIU ZIYANG: project-by-ID ownership check BEFORE session
  creation. Existing session endpoint still trusts projectId; proposed
  projectOf(sessionId) cannot validate a project before the session exists.
- [ ] LI ZHUOYANG + core: actual steering routes/commands and resource owner checks;
  reviewed steer.cancel and required events in contracts/parser. Current steering
  tests use fixture handlers, NOT real file/upload/worker integration.
- [ ] HE RONG: wire admin HTTP/UI to AdminAccounts, requireStaff and mutation
  protection. No billing route/button implementation was made in this session.

References: CORE_HANDOFF.md, PROJECTS_HANDOFF.md, STEERING_HANDOFF.md,
ADMIN_HANDOFF.md, PERSISTENCE.md. Do not edit their owned code silently.

### P4: review and delivery

- [x] Reviewed the uncommitted implementation on 2026-09-18 after reading the
  historical design.md and API.md. RUNTIME_API.md remains the implementation
  contract/mapping; docs/luyi/README.md explicitly preserves design.md/docx/PDF as
  the submitted historical design and identifies API.md as an earlier sketch.
- [x] Grouped local Conventional Commits after review: 46fa9c2 server/tests and
  e06a654 signin account/recovery UI, followed by acceptance/handoff documentation.
  Source/migrations are included; tmp, credentials, DB/outbox and browser artifacts
  are excluded. The backend is one coordinated increment; it is not a small PR.
- [ ] Confirm publication target before pushing. Earlier permission was personal
  mine/identity/auth-flow, not team origin/main or a production deployment.
- [ ] Owner-reviewed PRs, CI/security/deploy checks, real cross-slice acceptance,
  then merge. Neither passing local tests nor a handoff document completes DOD.
- [ ] Update this checklist with dates, evidence and any still-blocked items.

## Validation and local resume commands

Latest completed validation: full verify with PGlite, Arctic and real PostgreSQL
**339 passing tests**, none skipped, 88.53% line coverage; workspace build passed.
Default verify without optional tools: **282 passing / 57 explicitly skipped**,
71.61% lines. Formatting, lint and strict typecheck passed in both runs. See
PR_READINESS.md for parallel audit findings and fixes: callback admission before
SQL, rollback-only transactions, isolated mail telemetry and atomic password-proof
version checks at session issuance. Each defect was reproduced before its fix.
Real-provider browser acceptance is recorded above; external verification mail
passed, while real external password reset remains pending. The running local
server has not been restarted to load these latest source fixes.
Browser + real local PGlite/outbox: signup/login, member/staff behavior, profile and
password change, safe empty-account deletion, verification, reset, old cookie 401,
new-password login 200. Mobile recovery view inspected at 390px. Real GitHub and
Google success/repeat/logout paths were exercised later as recorded above; their
production dependency/configuration and real external reset acceptance remain unfinished.

From repository root (PowerShell):

```powershell
git status --short
npm run build
$env:IDENTITY_PGLITE_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/@electric-sql/pglite/dist/index.js'
$env:IDENTITY_ARCTIC_MODULE = Join-Path (Get-Location) 'tmp/identity-tools/node_modules/arctic/dist/index.js'
npm run verify
Remove-Item Env:IDENTITY_PGLITE_MODULE
Remove-Item Env:IDENTITY_ARCTIC_MODULE
# Only if no existing local harness is running:
node apps/server/dist/modules/identity/localPglite.js
```

If tools are absent, consult LOCAL_AUTH.md/OAUTH_SETUP.md before installing;
Arctic's deprecation warning is intentional and needs review. Local entry point
reads process environment; it does not automatically load .env. Stop/restart it
after configuration/code changes. Verify a stale lock's owner is gone before
removing tmp/identity-local-db.lock. Never delete the database to fix a port clash.

## Completion rule

Check a task only after code/configuration and its acceptance evidence exist.
Mark blocked tasks with the missing decision/owner/input and continue independent
identity work. Do not auto-run on computer login, auto-publish or operate external
accounts: resume when the user starts the next assistant session and asks to
continue. Keep user communication in Chinese and repository content in English.
