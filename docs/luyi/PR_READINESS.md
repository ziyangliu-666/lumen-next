# Identity PR readiness: 2026-09-18

## Current merged-base status: BLOCKED

Team main `e3937d4` was merged locally in `628f897` after the review below.
Full verification now reports **382 passed / 3 failed / zero skipped**, and
build passes. Default verify reports 311 passed / 74 skipped, including the
three failures among its skips; that green default does not prove readiness.

Core's newer schema omits account foreign keys for ledger_entries and sessions.
Identity's deletion therefore incorrectly succeeds with retained data. The
existing WASM ledger HTTP test and two new native-pg regressions are intentionally
left failing against the agreed retention contract. Do not expose deletion or
mark this branch ready for merge/deployment. Core/billing/session must approve
reference migrations or a retention policy integration before this can be fixed
without crossing ownership boundaries. See NEXT_SESSION.md for evidence.

Only personal-branch publication is authorized. No team PR or branch write is
included. Prior test totals and status below refer to the earlier base.

## Historical review checkpoint

Status: local implementation and review preparation, **not production completion**.
Two independent read-only Pi workers reviewed integration and OAuth; the lead
verified findings, wrote fixes/tests and owns all repository changes. No other
slice, shared dependency, production service or cloud configuration was changed.
No remote PR, push or merge is implied by this checkpoint.

## Completed in this review

- Real Resend verification email was received and submitted by the user. The lead
  independently checked GET /api/me/email-status: 200, verified=true. No address,
  code, password or key is included in this evidence.
- Fixed delivery-failure telemetry throwing through the generic forgot response.
  A regression first reproduced 500 instead of 202. Verification replacement and
  expiry tests were added as separate SQL/HTTP checks.
- Moved OAuth callback admission before attempt consumption/database work. Regular
  tests (no external tools needed) first reproduced repeated unbounded consume
  calls. Tests cover a single admission slot, malformed/cancelled callbacks,
  preserving an existing session on failure, no-store/no-referrer and actual
  logger output excluding callback code/state/binding values.
- Made postgresDatabase transactions rollback-only after any query failure, even
  when the callback catches the exception. Tests first reproduced a false success
  and now require rollback and preservation of the original error. This does not
  claim real PostgreSQL driver or concurrent-connection acceptance.
- Reproduced the reset/login stale-proof race with deterministic SQL/HTTP ordering:
  password verified, reset committed, then old login tried to issue a session.
  Password proof now carries its credential version to an atomic locked check
  before insertion. Explicit principal projection and tests keep proof metadata
  out of responses and persisted session rows. No shared-core principal changed.
- Reconciled current mail/OAuth acceptance claims in the public README, runtime
  contract and continuation documents. Historical evidence is not relabeled as
  current production acceptance.

## Remaining gates and responsible owners

| Gate | Current evidence / required action |
| --- | --- |
| Real external password reset | Pending user-controlled password account eligible for Resend delivery. User enters passwords/codes in browser; test must confirm old-session and old-password rejection and new-password login. Current OAuth-only account is ineligible. |
| Settings Account | AccountPanel works inside signin. Settings.tsx is still a placeholder. HE RONG and LIU ZIYANG must approve component ownership/composition; no cross-page import added. |
| Production composition | main.ts still uses headerStub and mounts session only. LIU ZIYANG must supply pg pool/runner, inject identity resolver and register identity routes, configure origin/cookies/lifetime and remove stub fallback. |
| Real PostgreSQL | pg is absent from the application dependencies; no PostgreSQL/Docker command/service was detected locally. A disposable approved PostgreSQL instance and driver are prerequisites, then multi-connection reset/signup/suspension and migration acceptance. PGlite does not replace this. |
| OAuth dependency | See recommendation below. Dependency installation, lockfile and production adapter require core-owner review. |
| Shared login state and WS | Shell still lacks shared real account state/guards. Open sockets retain handshake identity; revocation and WS Origin remain core/session work. |
| Admin and retention | Billing HTTP/UI wiring, last-staff policy, retained-resource deletion and OAuth-only reauthentication/linking need agreed scope and owner review. |
| CI/review/merge | Local tests are not remote CI. Confirm target repository/base/head, push reviewed commits, create Draft PR, request owners, then complete required CI/security/review before merge. |

## OAuth dependency recommendation (not approval)

Public npm metadata was checked on 2026-09-18:

- arctic 3.7.0 is explicitly deprecated/unmaintained. It remains an isolated local
  acceptance tool, not an application dependency.
- openid-client 6.8.8 depends on jose and oauth4webapi. Prefer evaluating it as the
  higher-level maintained OAuth/OIDC client, subject to core-owner approval.
- oauth4webapi 3.8.8 is a lower-level alternative; more protocol glue would remain
  identity-owned. Absence of a deprecation flag is not a security audit.

Keep the existing OAuthProvider injection seam. Arctic-shaped client ports are
not drop-in compatible with either candidate. An approved adapter must prove
Google and GitHub compatibility, GitHub S256/verifier exchange, state/browser
binding, cancellation, bounded transport/body handling and safe error/log behavior.
The current GitHub adapter has no PKCE. Application Promise.race deadlines do not
cancel underlying token exchanges and are not a total callback time budget.
Production HTTPS callbacks, proxy log redaction and distributed abuse controls
remain separate release gates. No package was installed during this review.

## Validation and publication checks

Final post-review local checks on 2026-09-18:

- `npm run verify` with external PGlite/Arctic tools: 321 tests passed, none skipped,
  88.15% line coverage; formatting, lint and strict typecheck passed.
- Default `npm run verify` without those tools: 282 passed, 39 explicitly skipped,
  71.61% line coverage. This is the reproducible default path, not full SQL acceptance.
- Workspace production build passed. Changed/untracked publication candidates
  passed a heuristic secret/artifact scan; `git diff --check` passed.
- New regressions were observed failing before their fixes. The stale-proof test
  deterministically orders operations; it does not prove multi-connection locking.
- The existing live local server was not restarted or reconfigured: browser mail
  evidence predates these source fixes. Re-enter private runtime configuration
  and retest after an explicitly coordinated restart; never extract its secrets.

Publication review scans only candidate source/docs, never credentials, the
running process environment or local mail bodies. Heuristic checks cover common
GitHub/Google/Resend keys, private keys and credential-bearing URLs; zero matches
is not a guarantee that no secret exists. Keep tmp, local databases/outboxes,
.env, browser artifacts and worker reports out of commits. Workers and their
reports are stored outside this repository.

Local commits: 46fa9c2 (server implementation/tests) and e06a654 (signin account/
recovery UI), followed by this acceptance/runtime and owner-handoff documentation.
The backend is a coordinated increment, not a small change; review its public
proof-metadata contract and security fixes explicitly. Push/PR target remains to
be confirmed; do not push to team main or claim release readiness.
