# OAuth: Sprint 3 integration

GitHub and Google strategies, adapters, attempt storage and callbacks are written
and tested with simulated provider exchanges. **The production composition does
not pass oauthProviders. Environment variables alone do not enable OAuth.**
`GET /api/auth/providers` returns false for both providers and sign-in buttons
remain disabled. This PR delivers password authentication, not live OAuth.

## Reviewed composition seam

The public index exports `githubProvider`, `googleProvider`, and their client
ports. Inject providers through `createIdentitySlice({ ..., oauthProviders })`.
Arctic **3.7.0** is pinned in the server manifest and lockfile, not loaded from
an ignored tools directory. Unit tests import the actual library and verify
callback/state and Google S256 challenge generation without contacting providers.

Arctic 3.7.0 and several transitive packages are deprecated. Architecture and the
PR review approve using Arctic; deprecation remains a maintenance risk to review
before enabling external authentication. A zero-vulnerability audit does not mean
the library is maintained. Google supports PKCE; this GitHub client does not
expose PKCE. Do not claim GitHub PKCE is implemented.

When the owner approves enabling OAuth:

1. Register user-owned GitHub/Google web applications and exact HTTPS callbacks
   at `/api/auth/github/callback` and `/api/auth/google/callback`.
2. Configure client IDs/secrets privately on the server, never under `VITE_*`.
3. Construct Arctic clients with those callbacks, wrap them with the identity
   adapters and inject them into the factory. Do not edit the template flow.
4. Confirm migration `core/db/migrations/003_identity_oauth.sql` is applied.
5. Test consent, cancellation, callback replay, conflicts and both role redirects
   against real providers. Simulated exchanges are not live-provider acceptance.

## Security contract

Attempts expire after ten minutes. State and independent browser binding are
hashed; the verifier remains short-lived server-side. Consume an attempt once,
with matching provider/state/browser cookie, before exchange. Binding cookies
are HttpOnly, SameSite=Lax, callback-scoped and Secure with HTTPS.

GitHub requires a verified primary email and stable numeric subject. Google uses
authenticated userinfo with a verified email and stable sub. No unverified ID
token is trusted. Provider tokens are not persisted or returned to the browser.
Accounts with matching emails are never automatically linked. Provider-only
accounts cannot perform password-based account changes.

Success redirects only to `/#/home` or `/#/admin`; failures use fixed safe codes.
Responses are no-store/no-referrer and callback request logging is silent.
Upstream proxies must redact callback query strings independently. Token exchange
and userinfo have ten-second deadlines; an injected client may continue its
transport after an application timeout. Distributed abuse control and cleanup
scheduling remain deployment requirements.

PostgreSQL tests cover callback replay, binding, expiry, cross-provider identity,
email conflicts and concurrent first login. See [API](API.md) and
[local validation](LOCAL_AUTH.md).
