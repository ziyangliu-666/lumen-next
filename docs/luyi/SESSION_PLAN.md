# Login session implementation plan

## Scope

Implement identity-owned login-session building blocks, not agent sessions. Keep core, contracts, main.ts, steering and database schema unchanged. Continue on `identity/auth-flow` with the existing uncommitted work preserved.

## Effort estimate

These are rough human engineering estimates, not elapsed agent runtime or a delivery promise. They refine the identity build work, not add a new budget to the proposal.

| Work | Estimate |
|---|---:|
| Storage port, token format and expiry decisions | 1 hour |
| Tests for issuance, lookup, expiry and revocation | 2 hours |
| Session service, Strategy and cookie resolver | 2 hours |
| Shared-flow integration, verification and documentation | 1 hour |
| Subtotal | 6 hours |
| Review/rework allowance (25%) | 1.5 hours |
| Total | 7.5 hours |

Excluded: durable SQL adapter/migrations, HTTP routes, cookie response handling, rate limiting/CSRF, UI and team integration. Estimate these after core's database API and session-policy review; do not count this subtotal as a complete login feature.

## Design and calculation

- Generate each bearer token from 32 cryptographically random bytes: 256 bits of entropy, encoded as 43 unpadded base64url characters. Use canonical encoding checks; a token is never an account id or an agent session id.
- Persist only SHA-256(token), a 64-character hex digest. High-entropy tokens do not need the slow password KDF. Do not log bearer tokens.
- The session store creates a record from accountId, tokenHash, createdAt and expiresAt. Lookups return the current principal and suspended state joined from the account, never a stale role captured at sign-in. Missing/deleted/revoked sessions resolve as null.
- Take an explicit positive, safe-integer lifetime in milliseconds from the caller; do not silently decide the team's session duration. Example calculation only: 7 * 24 * 60 * 60 * 1000 = 604800000 ms. Lifetime and renewal policy require owner confirmation before HTTP wiring.
- Inject the clock for deterministic boundary tests. A session expires when expiresAt <= now. Reject invalid stored timestamps and suspended accounts.
- Revoke one login by deleting its token hash; revoke all by accountId. Storage errors propagate and must not become successful logout or anonymous fallback.
- SessionStrategy verifies a raw opaque token. The resolver reads only the `lumen_session` cookie, ignores the development stub/header, and does not issue or renew a session per request.
- A concrete SessionAuthFlow uses the existing template's completion hook to issue a session after proof succeeds. It is an integration building block, not production wiring. Automatic refresh/rotation is out of scope.

## Test-first sequence

1. Write session-store contract and behavior tests; observe missing implementation failure.
2. Implement issuance/verification/revocation without a production in-memory adapter.
3. Write tests for Strategy/resolver and the common completion hook.
4. Implement them against core's existing PrincipalResolver and Credentials types.
5. Run npm run verify and git diff --check; document actual results separately from estimates.

## Acceptance checklist

- Unique random tokens; raw token never sent to the persistence port.
- Valid token resolves; malformed, unknown, expired, revoked and suspended cases do not.
- Exact expiry boundary and current account role are respected.
- Revoke-one and revoke-all call the correct storage methods; malformed signout tokens are harmless.
- Session cookies work without accepting spoofed Authorization/stub cookies.
- Resolution has no session-creation/renewal side effect.
- Shared authentication flow persists before returning a token and surfaces persistence failures.
- No claim that SQL persistence, immediate revocation of open sockets, or real sign-in endpoints are shipped.

## Actual result

Implemented the session service and store port in `authSessions.ts`, the Strategy
and core resolver in `sessionStrategy.ts`, and the completion hook in
`sessionAuthFlow.ts`. Added 39 tests, including an app.inject test against the
existing core: anonymous/stub callers get 401, a valid cookie resolves its
principal, and revocation causes the next request to get 401.

`npm run verify` passes: 141 tests, 97.48% line coverage. `git diff --check`
passes. The acceptance behavior above is covered at the port/test-adapter level;
there is no concrete durable adapter or production route wiring yet. Actual
human engineering time was not measured; the estimate is not a time log.

## Follow-up integration

The SQL adapter must join accounts on lookup, enforce unique token hashes and implement revocation durably. It must define account deletion/suspension races and transaction behavior. HTTP needs Secure/HttpOnly/SameSite cookie handling, cache controls, CSRF protection, bounded request/concurrency limits and reviewed lifetimes. Existing WebSockets need a separate revocation policy. Only then should core's composition-root owner replace headerStub.
