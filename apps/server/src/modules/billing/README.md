# billing — HE RONG

UC5 owns the ledger, wallet, budget checks, keys, payments and administration.
This Sprint 2 change delivers the ledger, Wallet tab and budget policy chain. Stripe, keys, persisted
approvals and administration remain separate stories.

## Public surface

`createBillingSlice({ db, canSpend? })` returns:

- `registerRoutes(app)` — register the authenticated wallet API once.
- `record({ accountId, taskId, amount, reason }, tx?)` — trusted in-process
  expense writer. Each call is one expense, not an idempotent retry. A supplied
  `Queryable` joins the caller's transaction; otherwise the INSERT commits alone.
- `monthSpend(accountId)` — `{ spent: Money, cap: Money }` for the UTC month.
- `budgetGuard` — the ordered account, monthly-cap and terminal approval policies.

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

## Budget policy chain (Sprint 2)

`BudgetChain` implements `BudgetGuard`. Its constructor copies an ordered list
of `BudgetHandler`s, each returning `Decision | null`. A decision short-circuits;
null passes to the next handler. An empty or exhausted chain denies. Storage
errors propagate unchanged, and invalid monetary estimates are rejected before
any handler runs. Caller code depends only on `BudgetGuard.check(charge)`.

The default chain is `AccountHandler` → `MonthlyCapHandler` → `ApprovalHandler`.
The account handler accepts an injected asynchronous eligibility check; a false
result denies and true passes. Without `canSpend`, it denies by default. Identity
must provide this through its public API when execution checks are connected;
billing does not inspect identity's tables or trust an account ID as eligibility.
The monthly handler allows when current UTC-month spend plus estimate is at most
the stored cap. Addition and comparison happen in one SQL query using numeric.
The terminal handler denies with `over the cap`; it creates no fake approval.

These classes and `BudgetHandler` are exported by the public index so a fourth
policy can be inserted without changing callers. The test uses a synthetic
escalation policy to prove extension; it is not a persisted approval feature.
The local `Charge`, `Decision` and `BudgetGuard` types match the agreed interface
and will move to core when that owner publishes `core/domain/budget.ts`.

This is a policy decision, not a reservation. Concurrent checks may observe the
same balance. Wiring the three execution checkpoints, reserving concurrent spend
and persisting approvals remain Sprint 3 integration work with session/identity.
The current main composition does not inject `canSpend` or call `budgetGuard`.
Saving a cap therefore does not claim to stop a running worker in Sprint 2.

Verification includes handler order, short-circuit, all three checkpoint labels,
account rejection, exact decimal equality at the cap, over-cap refusal, a fourth
policy with unchanged callers, empty-chain denial and propagated store errors.
