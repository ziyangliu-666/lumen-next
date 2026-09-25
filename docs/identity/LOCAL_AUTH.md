# Local password authentication

Use the normal monolith with PostgreSQL, not a separate identity server.
Node 22+ is required. Run from the repository root:

```sh
npm ci
docker compose up -d db
npm run build
```

Export these variables in the process environment (the server does not load
`.env` automatically):

```text
DATABASE_URL=postgres://lumen:lumen@localhost:5432/lumen
LUMEN_PORT=4000
LUMEN_ORIGIN=http://localhost:4000
IDENTITY_SESSION_LIFETIME_MS=86400000
IDENTITY_INSECURE_COOKIES=true
```

Start `npm run start --workspace @lumen/server` and open
`http://localhost:4000/#/signin`. Register a disposable test account. There is no
seed password or default staff grant. For Vite development on port 4173 use
`LUMEN_ORIGIN=http://localhost:4173`; mutation Origin must match the browser,
not the proxy's backend URL. For HTTPS use Secure cookies (false for the insecure
flag). Never enable insecure cookies on a non-loopback deployment.

The startup log names the active resolver. **With DATABASE_URL set, stub headers
and the lumen_stub cookie no longer authenticate any slice.** Without a database,
only non-production development retains the stub. Production refuses to start
without DATABASE_URL. Tell all slice owners before merging this switch.

Account management is reachable from the sign-in page. Password changes sign out
other sessions while retaining the current one. Sign-out-all invalidates every
session. Account deletion is in the Account settings and needs the current
password, or a sign-in in the last 10 minutes for a provider-only account. Settings composition belongs to the
shell owner; no cross-page import was added. StaffGuard protects the existing
admin route, but this PR does not implement billing's admin endpoints.

## Validation

Use a disposable PostgreSQL database for tests:

```sh
# Export DATABASE_URL first.
npm run verify
npm run build
docker compose -f docker-compose.staging.yml up -d --build --wait
```

`openTestDb()` migrates a unique schema per suite and drops only that schema.
CI already supplies DATABASE_URL, so identity SQL tests execute there. Without
it, database tests explicitly skip: a database-free green run is not acceptance.
No PGlite or external driver-module override is required. Pool-restart tests
prove durable database state, not a PostgreSQL server crash/restart.

Staging uses the three identity environment settings in its compose file. The
Deploy smoke test registers a real account, signs out, logs in with a cookie,
reads `/api/me`, rejects a forged stub and verifies signout. Projects is not yet
registered on the baseline main, so it does not post fabricated project IDs to
the session endpoint. Add project creation before session creation when that
slice lands. Container health and CI must be checked independently from local
native PostgreSQL tests.
