# UC1 Identity delivery plan

For the current ordered unfinished-task checklist and resume instructions, read
[NEXT_SESSION.md](NEXT_SESSION.md). Historical increment notes below are retained
as evidence and must not override that checkpoint or the current code.

## Goal and definition of done

Deliver real signup/signin, durable login sessions, account self-service, OAuth
and identity-owned mail, plus the reviewed interfaces used by billing and core.
A story is not done merely because unit tests pass: it needs the durable adapter
where relevant, UI/API integration, owner review, CI and a merged PR.

The working branch is `identity/auth-flow`, published to the personal `mine`
remote. See CONTEXT.md for the publication checkpoint. All new server code stays
under modules/identity. Sign-in UI stays under
pages/signin. Shared core/contracts, main.ts, shared UI and billing's settings
folder are not silently edited.

## Current increment: OAuth and account self-service

GitHub/Google strategies, adapters, callbacks and availability-driven UI are now
implemented. AccountPanel and restricted password-account deletion are included.
See OAUTH_SETUP.md for code/setup and explicit limitations. Real provider login
needs credentials; the architecture's Arctic dependency is now deprecated and
requires review/replacement before production. Mail verification/reset codes,
RecoveryPanel, local outbox and an optional Resend adapter are now implemented;
real Resend verification delivery passed; real external password reset and production
abuse/delivery guarantees remain pending (MAIL_SETUP.md). Earlier checkpoints below are historical evidence, not current scope.

## Earlier increment: PostgreSQL stores and composition

This branch includes the persistence increment for personal-repository handoff:
PostgresAccountStore, PostgresAuthSessionStore, createIdentitySlice and a candidate
migration. Publication target: mine/identity/auth-flow only; no team PR or merge. See PERSISTENCE_PLAN.md, PERSISTENCE.md and RUNTIME_API.md. The historical
signup/UI checkpoint below is retained as evidence, not the latest state.

Validation with the optional PostgreSQL WASM engine enabled: full verify passes,
240 tests, 98.14% line coverage; workspace build and diff check pass. Standard
runs without the external test tool run 233 tests and skip the 7 engine tests.
No application dependency was added. Core's actual pool/runner, multi-connection
PostgreSQL acceptance, main.ts wiring, review and deployment remain pending.

## Full backlog

| Order | Work and deliverable | Current state / dependency |
|---|---|---|
| 1 | Strategy + Template Method, password hashing/verification | Implemented and tested locally |
| 2 | Login-session token issuance, verification, revoke-one/all; cookie resolver | SQL store implemented locally; shared pool/runner and production integration pending |
| 3 | Password/signout/signout-all/me HTTP, origin checks and local abuse limits | Plugin tested; not mounted in main.ts |
| 4 | Signup service and POST /api/auth/signup | Implemented with transactional SQL adapter and engine rollback test; main wiring pending |
| 5 | Account service, PATCH /api/me and POST /api/me/password | Implemented/tested locally; sensitive changes require reauthentication and conditional writes |
| 6 | Sign-in/signup page | Implemented and browser-checked with mocked API; real backend integration pending |
| 7 | Durable AccountRepo and numbered migrations | SQL stores and candidate migration implemented; core must review port, assign migration number and provide pool/runner |
| 8 | Production composition-root wiring | Core owner review; inject real resolver, remove stub dependency, register plugin, configure trusted origin/cookies/lifetime |
| 9 | Settings Account UI | AccountPanel implemented and reachable within signin; canonical Settings composition still needs HE RONG/shell review |
| 10 | GitHub/Google strategies and OAuth routes | Implemented/tested with simulated exchange; live credentials/callbacks and deprecated Arctic dependency review remain pending |
| 11 | Account deletion | Password-proven empty-account deletion implemented; retained-resource/OAuth-only deletion blocked pending retention/provider reauthentication decisions |
| 12 | Verification/reset email and token lifecycle | Implemented/tested: hashed expiring single-use codes, generic forgot response, session revocation on reset, local outbox and injectable mail transport; live delivery/provider approval and production policy remain pending |
| 13 | Billing account public index | list/get/setRole/suspend implemented through the factory, typed summaries/errors exported and PGlite-tested; billing agreement, HTTP/UI wiring and review pending (ADMIN_HANDOFF.md) |
| 14 | Cross-slice integration | Steering/project ownership checks; HTTP/WS identity alignment; role routing is not server authorization; decide open-socket revocation |
| 15 | Hardening and release evidence | Production proxy/rate policy, password policy approval, security/DAST, browser accessibility/responsive checks, docs aligned, small commits/PRs |

## This increment: decisions and scope

- Add signup, profile update and password change behind a mandatory account
  service dependency of identityRoutes. Reuse the existing origin/no-store gates
  and bounded login admission for expensive hashing/reauthentication.
- Move AccountView/AccountReader into an identity-owned account contract file,
  re-export through the public index; never put server internals in the browser.
- Store ports must create account+credential atomically, enforce normalized-email
  uniqueness and return only public account data. New accounts are always users;
  request bodies cannot choose id, role, suspension or timestamps.
- New-password policy for this implementation: at least 15 Unicode code points,
  at most 1024 UTF-8 bytes; no forced character classes, trimming or normalization.
  This is a provisional local decision pending team review, not a previously
  agreed shared contract. Existing password login does not impose this new minimum.
- Name: trimmed, 1..80 characters (UTF-16 code units). Email: normalized as before
  (trim/lowercase), bounded to 320 characters and basic address syntax validation.
  This does not prove email ownership. Verification/linking remains a separate story.
- Name-only updates require a session. Email changes additionally require the
  current password; OAuth-only email changes wait for provider reauthentication.
- Password changes require the current password and an atomic conditional write
  against the hash just verified. A concurrent change returns a conflict rather
  than silently overwriting newer credentials. The submission leaves other login
  sessions alive after password change; retain this explicitly until reviewed.
- Signup returns 201 with principal and a cookie. Duplicate email returns 409 per
  the proposed contract; this intentionally discloses registration availability
  and must be reviewed alongside the prototype's anti-enumeration wording.
- Signup first commits the account+credential, then issues a session. If session
  persistence fails, return 500 with no cookie; the created account remains and
  the user can sign in. Do not unsafe-delete it as compensation. A future SQL
  adapter/transaction design may make the whole operation atomic.
- Account deletion, settings UI, email delivery and OAuth are not claimed as
  part of this increment. OAuth options on the sign-in page stay visibly disabled
  until their actual routes exist.

## Implementation sequence

1. Service/store contracts and validation tests, then account service.
2. HTTP integration tests, then signup/profile/password routes.
3. Page-local auth client and accessible sign-in/signup form using existing UI
   controls and theme. Keep the existing #/signin route; signup is a mode toggle
   until the shell owner adds a distinct signup route. Preserve non-secret query
   context when redirecting to #/home or #/admin; never persist passwords/tokens.
4. Run npm run verify and web build. Browser-check the form with mocked HTTP
   responses if the durable backend is unavailable; label mock evidence clearly.
5. Update CONTEXT/IMPLEMENTATION and record exactly what is not wired yet.

## Acceptance tests

- Valid signup stores only a hash, normalizes email and forces user role.
- Invalid/extra fields and weak new passwords fail before storage writes.
- Duplicate signup/profile email, missing/suspended account and storage failures
  fail safely with no password/token leakage.
- Wrong current password cannot change email/password; a concurrent password
  change cannot be overwritten by a stale proof.
- Protected changes target the authenticated account, never a caller-supplied id.
- Browser form submits once while pending; errors are accessible and secrets are
  cleared after a completed attempt; sign-in/signup switch, mismatch validation,
  role redirect and unavailable-backend feedback work.
- Full verify stays green. Browser mocks are not proof of production auth.

## Latest verification result

- 35 new service/HTTP tests in this increment, bringing the suite to 201 tests.
- npm run verify passes; 97.79% line coverage. Web production build passes.
- Playwright against the local Vite page with intercepted HTTP responses confirms
  pending/error behavior, password clearing, local confirmation checks, user and
  staff redirects, preserved query context and missing-endpoint feedback.
- Desktop 1280px and mobile 390px screenshots inspected; no horizontal overflow
  at 390px. A fresh page load has no console errors. Browser mocks are separate
  from server tests and do not prove real persistence/cookie integration.
- Browser evidence was moved outside the repository so generated MCP files do
  not pollute formatting checks. No shared-core, settings or shell changes.
- Implementation and plans are now committed and pushed to the personal branch.
  Team review, a PR and deployment have not been performed.

## Team questions to unblock the remaining work

1. LIU ZIYANG: review the IdentityDatabase port, candidate migration, normalized
   email uniqueness and suspended flag in PERSISTENCE.md. Confirm the shared
   pool/runner, migration number and composition-root wiring.
2. HE RONG: can Settings be split into an owner-neutral shell and Account vs
   Wallet/Keys components with matching CODEOWNERS? Confirm admin account types.
3. LI ZHUOYANG + PENG XUJIAN: latest steering PR and project ownership check?
4. Team: confirm signup error/privacy behavior, new-password minimum, session
   lifetime, email verification requirement, mail provider, proxy trust and
   credential-change/session-revocation policy.
