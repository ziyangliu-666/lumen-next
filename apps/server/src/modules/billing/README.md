# billing — HE RONG

UC5 owns the ledger, wallet, budget checks, keys, payments and administration.
This Sprint 2 change delivers the ledger and Wallet tab. Stripe, keys, persisted
approvals and administration remain separate stories.

## Public surface

`createBillingSlice({ db })` returns:

- `registerRoutes(app)` — register the authenticated wallet API once.
- `record({ accountId, taskId, amount, reason }, tx?)` — trusted in-process
  expense writer. Each call is one expense, not an idempotent retry. A supplied
  `Queryable` joins the caller's transaction; otherwise the INSERT commits alone.
- `monthSpend(accountId)` — `{ spent: Money, cap: Money }` for the UTC month.
- `budgetGuard` — denies until the separately tested policy chain is added.

The optional transaction is the only extension to the documented spend writer.
`main.ts` passes `billing.record` as session's `recordSpend` callback when a
Postgres Db exists. PgTrace determines the account from its own session record,
updates the task cost and invokes billing in the same transaction. Failure
rolls back both writes; the kernel publishes cost events only after commit.
Billing never queries or changes session's tables.

Without `DATABASE_URL`, authenticated wallet requests return 503. They do not
invent zero balances or accept non-durable writes. Session's existing memory
mode remains available for development without billing persistence.

## API

| Method and path | Input | Response |
| --- | --- | --- |
| GET /api/wallet | authenticated principal | `{ spent: { dollars }, cap: { dollars } }` |
| GET /api/wallet/ledger | `limit` (1–100, default 20), optional `cursor` | `{ entries, nextCursor }` |
| PATCH /api/wallet/cap | `{ cap: { dollars } }` | refreshed wallet summary |

Every route calls `requireUser`. Account selection always comes from the
principal, including for staff; body/query account IDs never select another
wallet. Errors use core's current `{ error: string }` envelope: 400 invalid
input, 401 no principal, 503 database unavailable, and sanitized 500 storage
failure. A cap is a monthly limit, not a prepaid balance. Saving it does not yet
enforce it during worker execution; enforcement and approval arrive in Sprint 3.

Money must be finite and non-negative, below 1000000 and at most six decimal
places. SQL stores `numeric(12,6)` and sums it. The browser displays four decimals
and never adds. Zero cap is the default from the agreed Sprint 2 plan.

The ledger lists all months, newest `(created_at, id)` first. Cursors encode the
last row ID; the boundary is resolved inside the account's SQL query, preserving
Postgres microsecond precision. A foreign or removed boundary returns no rows.
Each entry contains `id`, `taskId`, `amount`, `reason`, and ISO `createdAt`.
Project filtering is deferred until the projects integration is merged.

Migration `core/db/migrations/007_billing_wallets.sql` creates the billing-owned
cap table and pagination index. `ledger_entries` already exists in 001. The core
runner discovers the file; there is no second pool or migration runner.

## Verification

Run `docker compose up -d db`, then with the local DATABASE_URL set run
`npm run verify`. The Postgres suites use `openTestDb()` and isolated schemas.
They cover concurrent decimal records, month boundaries, account isolation,
microsecond pagination, invalid input, durable reads after recreating the slice,
and rollback of ledger plus trace when the writer fails. The integration test
runs the actual session demo worker and compares its delegated tree spend with
the wallet. API tests use `app.inject()`.

The Wallet tab has initial loading, error/retry, empty and populated states,
manual refresh, older/newest navigation, and validated cap editing. It uses
`@/core/api` and existing `@/ui` controls only.

## Ownership and remaining work

The migration and minimal `main.ts`/session transaction hook need LIU ZIYANG's
review. No shared contract or dependency is changed. Identity's real resolver
will authenticate these routes through core when its PR lands.

Do not import billing internals from another slice. Import this public index.
The admin implementation in identity PR #15 should be excluded from that PR;
it will be evaluated in a separate billing PR after the Sprint 2 money path.

A reviewed merge and green CI, Security and Deploy checks are required by
`docs/DOD.md`; local tests alone do not mean the story is delivered.
