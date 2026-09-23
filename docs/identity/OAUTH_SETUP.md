# OAuth configuration and integration

This change delivers validated GitHub/Google provider configuration through the
identity public index. **The tracked production composition still does not inject
providers. Environment variables alone do not enable OAuth until the shared
startup wiring is reviewed and applied.**

## Configuration contract

`oauthProvidersFromEnvironment(environment, origin, options?)` constructs Arctic
adapters from an explicitly supplied readonly environment map. It does not read
ambient process environment, log configuration values or contact providers.

| Variable | Purpose |
| --- | --- |
| GITHUB_OAUTH_CLIENT_ID | GitHub OAuth application client ID |
| GITHUB_OAUTH_CLIENT_SECRET | GitHub OAuth application client secret |
| GOOGLE_OAUTH_CLIENT_ID | Google Web OAuth client ID |
| GOOGLE_OAUTH_CLIENT_SECRET | Google Web OAuth client secret |

An absent or empty pair disables that provider. Partial pairs, padded values and
control characters fail with value-free errors. Either provider can be enabled
independently. Never put credentials under VITE_ variables or in tracked files.

Enabled providers require a canonical HTTPS origin by default: no path, query,
fragment, userinfo or trailing slash. Callbacks are derived from that origin:

- `/api/auth/github/callback`
- `/api/auth/google/callback`

For explicit local acceptance, `{ allowLoopbackHttp: true }` permits canonical
HTTP only for localhost, 127.0.0.1 or [::1]. LAN addresses, wildcard interfaces,
noncanonical IP aliases and remote HTTP remain prohibited. Startup permits
this exception only outside production with the explicit insecure
cookie flag. Production remains HTTPS-only.

## Shared startup handoff

The composition root wires providers in two places:

1. main.ts constructs providers from server configuration through identity's
   public index.
2. app.ts accepts an optional readonly OAuthProvider array in IdentityConfig and
   forwards it to createIdentitySlice. composeApp does not read the environment.

The core owner approved both files on the identity pull request. A green
build is not production acceptance. Add composition-level coverage
for disabled, single-provider and dual-provider configuration, then verify the
applied source. Do not enable mail as part of this change.

## Provider setup and acceptance

Use team-owned OAuth applications for deployment. Register exact callback URLs
matching the application's configured origin. Configure secrets privately through
the deployment environment or secret manager; never share them in commits, PRs,
screenshots, logs or browser bundles.

For localhost development, the explicit loopback option supports callbacks such
as `http://localhost:4000/api/auth/google/callback`. The application and callback
must use the same origin. Production requires the reviewed HTTPS deployment.

Before enabling external authentication:

- Confirm the shared migration runner applied 003_identity_oauth.sql.
- Confirm /api/auth/providers advertises only the injected providers.
- Use authorized test accounts; the account owner completes login, MFA and
  permission approval personally.
- Exercise successful login, cancellation, conflicts, replay handling, logout,
  reload persistence and role-based destinations.
- Keep only sanitized outcome evidence. Do not record account identifiers,
  callback query strings, cookies, tokens or provider credentials.

Both providers were enabled together in a local PostgreSQL-backed integration
preview. Separate real-provider login checks succeeded: Google logout/relogin was
confirmed interactively; GitHub returned to Home and /api/me returned 200 before
and after reload. These outcomes do not imply production wiring or completion of
all negative/staff cases. Private acceptance artifacts and test identities are
not part of this delivery.

## Security and maintenance limits

Arctic 3.7.0 is pinned in the server manifest and lockfile. Its deprecation and
transitive maintenance risks require review before public deployment. Google
supports S256 PKCE; the pinned GitHub client does not expose PKCE. Do not claim
GitHub PKCE support.

Attempts expire after ten minutes. State and separate browser binding are hashed;
the verifier remains short-lived server-side. Attempts are consumed once before
exchange, with matching provider/state/browser binding. Cookies are callback-scoped,
HttpOnly, SameSite=Lax and Secure with HTTPS.

GitHub requires a verified primary email and stable numeric subject. Google uses
authenticated userinfo with verified email and stable sub. No unverified ID token
is trusted. Provider tokens are not persisted or returned to the browser.

Matching email addresses are never automatically linked. Provider-only accounts
cannot perform password-based sensitive changes. Cross-provider account linking
requires a separate reviewed design, not an implicit email match.

Success uses fixed Home/Admin destinations; failures use fixed safe codes.
Responses are no-store/no-referrer and callback logging is silent. Upstream
proxies must independently redact callback query strings. Exchange and userinfo
have ten-second deadlines; an injected client may continue its transport after
an application timeout. Distributed abuse control and cleanup remain deployment
requirements. Existing socket-principal revalidation is a shared-core limitation.

See [API](API.md), [local validation](LOCAL_AUTH.md) and [delivery status](DELIVERY.md).
