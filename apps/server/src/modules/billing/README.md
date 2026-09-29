# billing — HE RONG

UC5 owns the ledger, wallet, budget checks, keys, payments and administration.
This Sprint 2 change delivers the ledger, Wallet tab and budget policy chain. Stripe, keys, persisted
approvals and administration remain separate stories.

## Public surface

`createBillingSlice({ db, canSpend?, adminAccounts? })` returns:

- `registerRoutes(app)` — register the authenticated wallet and staff-only account APIs once.
- `AdminAccountReader` — a read-only projection of identity's public `AdminAccounts` port, injected as `adminAccounts`; no role or suspension mutation is exposed.
- `record({ accountId, taskId, amount, reason }, tx?)` — trusted in-process
  expense writer. Each call is one expense, not an idempotent retry. A supplied
  `Queryable` joins the caller's transaction; otherwise the INSERT commits alone.
- `monthSpend(accountId)` — `{ spent: Money, cap: Money }` for all recorded account spend and the flat cap; the historical port name is retained.
- `budgetGuard` — the ordered account, cap and terminal approval policies.

The optional transaction is the only extension to the documented spend writer.
`app.ts` passes `billing.record` as session's `recordSpend` callback when a
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
failure. A cap is a flat account spending limit, not prepaid balance. Saving it does not yet
enforce it during worker execution; enforcement and approval arrive in Sprint 3.

Money must be finite and non-negative, below 1000000 and at most six decimal
places. SQL stores `numeric(12,6)` and sums it. The browser displays four decimals
and never adds. The store supplies a USD 1.000000 cap when no wallet row exists, as agreed by
PM/core in [#52](https://github.com/ziyangliu-666/lumen-next/issues/52#issuecomment-5862311033).
A saved zero remains zero. Both the wallet and guard use the same SQL projection.
There is no monthly reset: spend sums all ledger entries for the account.

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
They cover concurrent decimal records, no-reset month boundaries, account isolation,
microsecond pagination, invalid input, durable reads after recreating the slice,
and rollback of ledger plus trace when the writer fails. The integration test
runs the actual session demo worker and compares its delegated tree spend with
the wallet. API tests use `app.inject()`.

The Wallet tab has initial loading, error/retry, empty and populated states,
manual refresh, older/newest navigation, and validated cap editing. It uses
`@/core/api` and existing `@/ui` controls only.

## Ownership and remaining work

The ledger migration and session transaction hook are merged. Identity's real
cookie resolver authenticates these routes when identity is configured. Changes
to the composition root still require core/session review.

Do not import billing internals from another slice. Import this public index.
Billing takes ownership of the read-only admin routes and page omitted from
identity PR #23; the closed PR #15 is a reference, not a dependency to merge.
See the decision below.

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
provides this through its public API and app.ts injects it since #50 merged;
billing does not inspect identity's tables or trust an account ID as eligibility.
`MonthlyCapHandler` retains its historical name. For a positive estimate it
allows when all-time spend plus estimate is at most the account cap. Zero means
unknown cost and requires strictly positive remaining room; equality denies.
Addition and comparison happen in one SQL query using numeric.
The terminal handler denies with `over the cap`; it creates no fake approval.

These classes and `BudgetHandler` are exported by the public index so a fourth
policy can be inserted without changing callers. The test uses a synthetic
escalation policy to prove extension; it is not a persisted approval feature.
`Charge`, `Decision`, `BudgetGuard` and `CheckPoint` come from
`core/domain/budget.ts` and are re-exported by the billing public index. Billing
keeps only its own `Spend` and `WalletSummary` shapes in `ports.ts`.

This is a policy decision, not a reservation. Concurrent checks may observe the
same balance. The PM deferred reservations beyond this sprint in #52. Wiring the three
execution checkpoints and persisting approvals remain separate integration PRs.
The current main composition injects `canSpend` but does not call `budgetGuard`.
Saving a cap therefore does not yet stop a running worker.

Verification includes handler order, short-circuit, all three checkpoint labels,
account rejection, exact decimal equality at the cap, over-cap refusal, a fourth
policy with unchanged callers, empty-chain denial and propagated store errors.

## Admin ownership decision 28 September 2026

HE RONG will implement `GET /api/admin/accounts`,
`GET /api/admin/accounts/:id` and `pages/admin` in a separate billing PR.
Reuse the read-only approach from closed PR #15, adapted to the existing
billing factory rather than replacing its wallet, ledger or budget ports.
The decision was communicated to LU YI on
[identity PR #50](https://github.com/ziyangliu-666/lumen-next/pull/50#issuecomment-5862186602).
This section assigns the work; it does not claim those routes exist on main.

Identity owns account storage and exposes `AdminAccounts` through its public
index. Billing owns HTTP authorization and presentation: require staff on both
routes, validate IDs, return only account summaries, and prevent caching.
The page will use the shared web request helper and the existing shell staff
guard, with loading, empty, error, list and detail states. No billing query
will read identity's tables.

Account deletion from #49 is already on main. A detail lookup returning null
must return 404 and show that the account is unavailable, including deleted
accounts. Do not recreate identities or reconnect records by email. Preserve
the agreed tombstone account association and ledger history. The current
flat cap is not prepaid balance. In #52 the PM decided future test-mode positive
credit is forfeited on deletion, with disclosure before confirmation. This is
policy for the later Stripe/deletion integration, not implemented credit here.

Acceptance for the implementation PR includes anonymous 401 and member 403 on
both list and detail before calling identity, staff success, invalid ID 400,
missing/deleted account 404, sanitized storage errors, no credential fields,
no-store responses and browser verification of direct member navigation and
mobile layout. Role and suspension mutations, invites and emergency stop are
excluded until their authorization and session-revocation rules are agreed.


## Read-only administration implementation

The admin increment provides `GET /api/admin/accounts` returning `{ accounts }`
and `GET /api/admin/accounts/:id` returning `{ account }`. `app.ts` supplies the
identity instance through its public index. Both endpoints require staff before
calling identity, set `Cache-Control: no-store`, and explicitly project only
id, email, displayName, role, suspended and createdAt. Invalid UUIDs return 400;
missing or deleted accounts return 404. Missing identity returns 503 after
staff authorization; unexpected failures use core's sanitized 500 response.

The Admin page replaces the sample row with the live directory and account
details. It uses the existing shell staff guard, request helper and UI controls.
It has loading, empty, error/retry, refresh and unavailable-detail states; stale
requests are cancelled when changing selection or leaving the page. Spend,
role changes, suspension controls and deleted-account recovery are not part of
this read-only view. The public identity list currently has no pagination port;
pagination must be agreed with identity before growing that API.

`adminRoutes.test.ts` covers authorization before identity access, summary-only
responses, no-store on errors, invalid IDs, empty/missing results, sanitized
failures and unavailable identity. `adminIntegration.test.ts` proves that the
composition serves real identity summaries to a staff cookie, denies a member
cookie, and refuses forged stub credentials with real identity enabled.
