# UC1 Identity delivery plan

## Goal and definition of done

Deliver real signup/signin, durable login sessions, account self-service, OAuth
and identity-owned mail, plus the reviewed interfaces used by billing and core.
A story is not done merely because unit tests pass: it needs the durable adapter
where relevant, UI/API integration, owner review, CI and a merged PR.

The working branch is `identity/auth-flow`. Existing work is uncommitted; preserve
it. All new server code stays under modules/identity. Sign-in UI stays under
pages/signin. Shared core/contracts, main.ts, shared UI and billing's settings
folder are not silently edited.

## Full backlog

| Order | Work and deliverable | Current state / dependency |
|---|---|---|
| 1 | Strategy + Template Method, password hashing/verification | Implemented and tested locally |
| 2 | Login-session token issuance, verification, revoke-one/all; cookie resolver | Implemented against store ports; durable adapter pending |
| 3 | Password/signout/signout-all/me HTTP, origin checks and local abuse limits | Plugin tested; not mounted in main.ts |
| 4 | Signup service and POST /api/auth/signup | Implemented/tested locally against an atomic creation port; SQL adapter pending |
| 5 | Account service, PATCH /api/me and POST /api/me/password | Implemented/tested locally; sensitive changes require reauthentication and conditional writes |
| 6 | Sign-in/signup page | Implemented and browser-checked with mocked API; real backend integration pending |
| 7 | Durable AccountRepo and numbered migrations | Coordinate database/query API and migration runner with LIU ZIYANG first; no competing core/pool |
| 8 | Production composition-root wiring | Core owner review; inject real resolver, remove stub dependency, register plugin, configure trusted origin/cookies/lifetime |
| 9 | Settings Account UI | Coordinate Account component ownership with HE RONG; no cross-page import or unreviewed edit to billing's folder |
| 10 | GitHub/Google strategies and OAuth routes | arctic dependency/core approval; provider credentials, registered callbacks, state/PKCE lifecycle, verified identity and safe linking policy |
| 11 | Account deletion | Agree dependent projects/sessions/ledger retention, recent reauthentication and stop/delete transaction semantics; never blindly cascade financial data |
| 12 | Verification/reset email and token lifecycle | Choose approved transport, templates, expiry, single-use hashed tokens, generic forgot response, rate limits; scope approval notifications with billing |
| 13 | Billing account public index | list/get/setRole/suspend contracts and errors agreed with HE RONG; current roles/suspension enforced on sessions |
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
- Work remains uncommitted/unreviewed; no push, PR or deployment was performed.

## Team questions to unblock the remaining work

1. LIU ZIYANG: what database query/transaction API and migration directory/runner
   will core expose? Who reviews normalized email uniqueness and account flags?
2. HE RONG: can Settings be split into an owner-neutral shell and Account vs
   Wallet/Keys components with matching CODEOWNERS? Confirm admin account types.
3. LI ZHUOYANG + PENG XUJIAN: latest steering PR and project ownership check?
4. Team: confirm signup error/privacy behavior, new-password minimum, session
   lifetime, email verification requirement, mail provider, proxy trust and
   credential-change/session-revocation policy.
