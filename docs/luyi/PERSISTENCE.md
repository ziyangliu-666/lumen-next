# Identity PostgreSQL integration guide

## What this increment provides

- `PostgresAccountStore`: parameterized PostgreSQL queries for AccountStore and
  PasswordAccountStore. Signup writes account + credential in one transaction.
- `PostgresAuthSessionStore`: insert/find/revoke-one/revoke-all, storing SHA-256
  token hashes and joining current account role/suspension on every lookup.
- `IdentityDatabase` / `IdentitySql`: injected connection/transaction ports.
- `createIdentitySlice`: assembles the real stores, password/session strategies,
  services, cookie-only resolver and HTTP plugin without any test store.
- `migrations/002_identity_auth.sql`: a candidate migration, not automatically
  applied. It adds accounts.suspended, normalized email uniqueness, credentials,
  auth_sessions and supporting indexes.

All code lives under `apps/server/src/modules/identity`. No dependency, core file,
composition root or other owner's page was changed. The default application still
uses headerStub and does not mount identity. This increment is not deployment.

## Database port obligations

Core must supply one shared pool and its reviewed migration runner. There is no
identity-owned pool or runner. Identity now exports `postgresDatabase(pool)` to
adapt the structural pg pool contract directly; it handles BEGIN/COMMIT/ROLLBACK
on one client, releases it in finally and discards it if rollback fails. It does
not construct/end the pool or apply migrations. Adapter tests use a client double;
real PostgreSQL driver/concurrency acceptance is still pending. Its output is:

```ts
interface IdentitySql {
  query<Row extends object>(text: string, values: readonly unknown[]): Promise<Row[]>;
}
interface IdentityDatabase extends IdentitySql {
  withTransaction<T>(work: (transaction: IdentitySql) => Promise<T>): Promise<T>;
}
```

A pg-backed query passes bound parameters (copy with `[...values]` if necessary)
and returns `result.rows`. A transaction obtains one client, begins a transaction,
calls the callback with queries bound to that client, awaits COMMIT on success,
ROLLBACK on failure and always releases the client. Never route a transaction's
queries through separate pool connections. READ COMMITTED is sufficient; stronger
isolation may produce serialization errors that must not be hidden as success.
Do not log SQL parameter values containing password hashes or session hashes.

The factory also exposes `suspend(accountId, on)` for trusted admin callers.
Suspension and deletion of all login sessions commit atomically; unsuspension
never restores a cookie. Billing must enforce requireStaff before this call and
must not update the suspended column directly. A missing account rejects with
an error; deletion failure rolls back the entire operation. Session insertion
also uses IdentityDatabase.withTransaction, locking the active account before
inserting so a suspended account cannot receive a fresh session. Repeat this
race against real multi-connection PostgreSQL before deployment. This does not
terminate requests already authorized or disconnect already-open WebSockets.

Identity locks the account before its password credential for sensitive changes.
Other account writers must preserve this lock order and honor suspension. The
password hash checked by AccountService is re-read under the locks; a stale proof
returns null/false and cannot overwrite a concurrent credential change.

Only PostgreSQL unique violations for `accounts_email_key` (the existing base
constraint) and `identity_accounts_email_normalized_key` become `email_taken`.
All other database failures propagate to core's generic 500 handler.

## Migration review and rollout

1. LIU ZIYANG assigns the final migration number/location. The candidate assumes
   the current base accounts table; it is intentionally not a migration runner.
2. Check normalized duplicates before applying:

   ```sql
   select lower(btrim(email)) as normalized_email, count(*)
   from accounts
   group by lower(btrim(email))
   having count(*) > 1;
   ```

   Reconcile conflicts with the owners. Do not auto-merge accounts or normalize
   away a collision. The migration fails rather than silently accepting them.
3. The shared runner applies the entire file in one transaction, once. No
   `IF NOT EXISTS` hides incompatible pre-existing tables or constraints.
4. Review backup/rollback procedures. No destructive down migration or cascade
   deletion of projects, sessions or ledger data is included.
5. Review production session lifetime, HTTPS origin, local vs deployment-wide
   rate limiting and database privileges before exposing routes.

The migration reserves GitHub/Google credential shapes but does not implement
OAuth. One account has at most one credential per kind, and an external provider
identity cannot be linked to two accounts. Password-only credentials have no
external identity. This is a proposed storage policy for owner review.

## Composition-root integration (owner-reviewed follow-up)

After core has connected the database and applied migrations:

```ts
import { createIdentitySlice, LoginGate } from './modules/identity/index.js';

const identity = createIdentitySlice({
  database: coreDatabaseAdapter,
  origin: configuration.publicOrigin,
  sessionLifetimeMs: configuration.sessionLifetimeMs,
  loginGate: new LoginGate(),
  // secureCookies defaults to true; false is accepted only for loopback HTTP.
});
const app = await buildServer({
  broker,
  resolver: identity.principalResolver,
  access: session.access,
});
await app.register(identity.registerRoutes);
```

The configuration/database variables above are explicit integration placeholders,
not exports that core already provides. Use the same resolver for HTTP and the
WebSocket handshake. Do not fall back to headerStub for a missing/invalid cookie.
Existing routes still use requireUser; project/session authorization remains with
the owning slices. Already-open socket revocation needs a separate decision.

Signup commits the account and credential before issuing a login session. If
session insertion fails, the account remains; the response is 500 without a cookie
and the person can sign in later. Do not delete the account as compensation.

## Tests and how to reproduce

The normal `npm run verify` includes store query-contract and factory tests.
Those tests use queued SQL replies and do not prove SQL execution or concurrency.

`postgresEngine.test.ts` is an optional integration suite using PGlite 0.5.8, a
PostgreSQL WASM engine installed outside the repository as a temporary test tool.
No PGlite package is added to the application or lockfile. Each suite creates its
own in-memory engine; it accepts neither an existing database URL nor a data
folder, so the tests cannot truncate a developer's database.

Example in PowerShell, from the repository root:

```powershell
$tool = Join-Path $env:TEMP ("lumen-identity-pg-" + [guid]::NewGuid())
npm install --prefix $tool --no-package-lock --ignore-scripts --no-audit --no-fund '@electric-sql/pglite@0.5.8'
$env:IDENTITY_PGLITE_MODULE = Join-Path $tool 'node_modules/@electric-sql/pglite/dist/index.js'
npx vitest run apps/server/src/modules/identity/postgresEngine.test.ts
# Optional: run the same engine tests alongside the complete quality gate.
npm run verify
Remove-Item Env:IDENTITY_PGLITE_MODULE
```

Without that environment variable the optional suite is explicitly skipped.
The temporary tool directory can be removed after use; do not commit it.

The engine suite checks actual DDL, unique/check constraints, rollback, timestamp
conversion, profile/password changes, stale proof rejection, live role/suspension,
expiry/revocation and the HTTP signup-to-signout flow across fresh app instances.
It does not prove PostgreSQL 17 driver integration, filesystem/process restart
persistence, network failures, multiple-connection locks or production readiness.

Before main.ts integration is accepted, repeat against a disposable PostgreSQL 17
service through core's real pool/runner. Include concurrent normalized-email
signup (one succeeds), simultaneous password changes using the same proof (one
succeeds), update vs suspension, failed COMMIT, rollback, restart persistence,
HTTP/WebSocket authentication and cross-account authorization.
