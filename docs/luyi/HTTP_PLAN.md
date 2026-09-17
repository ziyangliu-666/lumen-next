# Identity HTTP increment

## Precondition and boundary

Refreshed origin before this increment. Shared core still exposes schema.sql only:
there is no database pool/query API or migration runner. Do not add a competing
core or claim durable storage exists. This increment adds testable routes inside
identity; main.ts, shared contracts, schema and other slices stay unchanged.

## Plan

1. Test and implement a bounded, per-process login admission guard: attempts per
   direct peer, a bound on tracked peers and a global concurrent-login ceiling.
   Refuse when full; never evict an active peer to reset its attempt count.
2. Test and implement POST /api/auth/password, /signout, /signout-all and
   GET /api/me using the existing flow, session service and an account-reader port.
3. Require a configured trusted origin for mutation requests, JSON login bodies,
   and no-store responses. Set a host-only, HttpOnly, Secure, SameSite=Lax session
   cookie with Path=/ and the server-side session expiry. Insecure cookies require
   an explicit development setting and a loopback HTTP origin.
4. Login returns only accountId/role, never the token in JSON. Clear cookies on
   successful signout. Invalid credentials use the same generic 401 response;
   storage failures remain generic 500 through core. Use core's implemented
   { error: string } envelope, not the unmerged nested-code proposal.
5. Use app.inject tests with test-only stores and the actual core resolver hook.
   Run full verify and record boundaries honestly.

## Provisional local guard settings

Five attempts per minute per direct socket peer, at most 10000 tracked peers,
and at most four concurrent login operations. Limits are configurable and need
load testing and owner review. Use the socket peer rather than request.ip because
core currently trusts proxy headers unconditionally; forged X-Forwarded-For must
not bypass the guard. Behind a reverse proxy this conservatively groups clients;
a reviewed trusted-proxy/edge policy is needed before deployment.

This guard is per process, not a distributed abuse-control system. Proxy-level
body/concurrency limits, account-level controls and deployment-wide rate limits
remain integration requirements. Exact Origin matching is a browser-CSRF gate,
not an identity proof or a defense against direct malicious API clients.

## Result

Implemented identityRoutes and LoginGate, with 25 new tests written before
implementation and expanded for failure cases. Full npm run verify passes:
166 tests, 97.74% line coverage, no lint warnings. git diff --check passes.

Tests exercise the actual Fastify core and identity cookie resolver, but stores
remain test doubles. No core/main/schema edits or dependency additions were
made. Code is committed and pushed to the personal branch (see CONTEXT.md),
but remains unreviewed; routes are not mounted by main.ts.

## Excluded

Signup/account mutation, concrete SQL storage, OAuth, password reset, frontend,
production wiring and immediate revocation of already-open WebSockets. Login
session duration remains a caller-supplied policy. HTTP tests must not be
presented as proof of database durability or a deployed authentication system.
