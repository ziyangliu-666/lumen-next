# Identity admin account interface for billing

Implementation checkpoint: 2026-09-18. This is an in-process interface, not a new
HTTP API. Billing owns admin routes/buttons; core owns composition-root wiring.

## Obtain the interface

Import only from the identity public index:

```ts
import type { AdminAccounts, AccountSummary } from './modules/identity/index.js';
import { AdminAccountFailure, createIdentitySlice } from './modules/identity/index.js';
```

The example paths are relative to server src/main.ts. A sibling slice uses
../identity/index.js. Core creates the identity instance once using its database
adapter and passes that same instance to billing as AdminAccounts. There are no
module-global functions or a second connection pool to configure.

```ts
interface AdminAccounts {
  listAccounts(): Promise<AccountSummary[]>;
  getAccount(id: string): Promise<AccountSummary | null>;
  setRole(id: string, role: 'user' | 'staff'): Promise<void>;
  suspend(id: string, on: boolean): Promise<void>;
}
```

## Data and behavior

AccountSummary contains only id, email, displayName, role, suspended and createdAt
(epoch milliseconds). Password hashes, credential/provider records and session
hashes are never included. SQL selects explicit columns; outputs are projected
again to prevent accidental extra adapter fields escaping.

| Method | Behavior |
|---|---|
| listAccounts | All accounts, including suspended ones, ordered by created_at then id. Empty database returns []. No pagination in this initial agreed shape. |
| getAccount | Includes suspended accounts; missing UUID returns null. This is distinct from self-service GET /api/me and the store's active-only getAccount. |
| setRole | Accepts only user/staff, changes exactly one account, repeated assignments are safe. Does not unsuspend or restore revoked sessions. Existing sessions resolve the latest role on their next authenticated request. |
| suspend(true) | Updates suspension and deletes all account login sessions in one transaction; repeated suspension is safe. Failure rolls back both changes. |
| suspend(false) | Unsuspends without creating/restoring sessions; requires fresh login. |

Role changes can target suspended accounts, but they remain suspended. Session
issuance and suspension serialize on the account row lock. Already-authorized
requests and open WebSockets are not retroactively cancelled.

## Caller obligations and errors

This trusted interface has no request/principal argument and does not perform
HTTP authorization. Billing must call requireStaff, validate UUID parameters and
body fields, and protect cookie-authenticated mutations against CSRF before
calling it. Do not expose these functions to members or call them from /api/me.
Do not write accounts directly from billing.

AdminAccountFailure is exported from the public index:

| code | Suggested HTTP mapping in billing |
|---|---|
| account_not_found | 404 for setRole/suspend; getAccount instead returns null |
| invalid_role | 400 |
| invalid_suspension | 400 |

Unexpected storage errors propagate; keep core's generic 500 response rather than
leaking database detail. Invalid UUID HTTP inputs should be rejected by billing
before calling the typed interface, not interpreted as missing accounts.

Self-demotion, suspending the last active staff account, audit events, recent
reauthentication and pagination are not implemented by these primitives. Agree
those policies before releasing an admin UI. Do not claim that role-routing or a
local probe is acceptance of billing's actual authorization boundary.

## Evidence and remaining integration

- Query tests: empty lists, suspended visibility, stable ordering, safe projection,
  parameter binding, invalid runtime role/boolean, missing accounts and failures.
- PGlite SQL + HTTP tests exercise all four methods through the factory, live
  member/staff role changes on existing cookies, suspension, revoked cookies and
  isolated accounts. The account self-service view still hides suspended users.
- Full verify with PGlite enabled: 260 tests pass, 89.56% line coverage.
- No billing/admin page, shared router, production main.ts or dependency change.
- Remaining: owner review, billing HTTP/button wiring, production PostgreSQL
  pool/migrations and multi-connection concurrency acceptance.
