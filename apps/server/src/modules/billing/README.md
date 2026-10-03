# billing — HE RONG

UC5 owns the ledger, wallet, budget checks, keys, payments and administration.
The ledger, Wallet tab, budget guard connection and read-only administration are
merged. This approval increment adds durable decisions and session resumption against #62.
Stripe test-mode top-ups are implemented below; keys remain a separate story.

## Public surface

`createBillingSlice({ db, canSpend?, adminAccounts?, approvalResume?, origin?, topups? })` returns:

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
mode remains available for development without billing persistence. As requested
in core/session review on #56, the guard integration is enabled only when a Db
exists, just like `recordSpend`. Database-free development sessions can run; a
database-backed process still requires real identity eligibility.

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
failure. A cap is a flat account spending limit, not prepaid balance. Since #56,
the saved cap is checked before turns, fan-out and task opening in database-backed
sessions. Work already running is not interrupted or reserved against the cap;
over-cap work waits for an owner decision when the approval resume port is configured.

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
When the resume port is configured, a stored-approval policy runs after identity
and before the cap policy. Rejected attempts deny, pending attempts escalate and
consumed attempts allow. The terminal handler persists a request and escalates
when the cap does not allow the charge. Without the port it still denies with
`over the cap`. Identity eligibility is checked on every path.

These classes and `BudgetHandler` are exported by the public index so a fourth
policy can be inserted without changing callers. The test uses a synthetic
escalation policy to prove extension; the durable approval integration is exercised separately by `approvalFlow.test.ts`.
`Charge`, `Decision`, `BudgetGuard` and `CheckPoint` come from
`core/domain/budget.ts` and are re-exported by the billing public index. Billing
keeps only its own `Spend` and `WalletSummary` shapes in `ports.ts`.

This is a policy decision, not a reservation. Concurrent checks may observe the
same balance. The PM deferred reservations beyond this sprint in #52.
Since the merge of #56, `app.ts` passes `billing.budgetGuard` to session when a Db
exists, following PM/core approval in #52 and prerequisites #50 and #55. The
existing turn, fan-out and task-open checkpoints consult the chain.
A denial prevents the checked work. Turn refusal records its reason in the trace;
fan-out refusal rejects `WorkerReport.delegate` with the reason. If the worker
lets that rejection propagate, the parent fails without opening any children. Unknown-cost work
needs remaining room; it is not a guarantee against overshoot within a running
step or concurrent tasks. Durable approval authorizes only the stored attempt.
`app.test.ts` exercises the composition with real sign-in and Postgres: a new
account runs below its default cap, saved over-cap and zero-cap accounts cannot
start work, and an exhausted parent cannot open delegated work.

Verification includes handler order, short-circuit, all three checkpoint labels,
account rejection, exact decimal equality at the cap, over-cap refusal, a fourth
policy with unchanged callers, empty-chain denial and propagated store errors.

## Admin ownership decision 28 September 2026

HE RONG owns `GET /api/admin/accounts`, `GET /api/admin/accounts/:id` and
`pages/admin`, delivered in merged PR #58. The implementation uses the existing
billing factory and preserves its wallet, ledger and budget ports.
The decision was communicated to LU YI on
[identity PR #50](https://github.com/ziyangliu-666/lumen-next/pull/50#issuecomment-5862186602).

Identity owns account storage and exposes `AdminAccounts` through its public
index. Billing owns HTTP authorization and presentation: require staff on both
routes, validate IDs, return only account summaries, and prevent caching.
The page uses the shared web request helper and existing shell staff guard,
with loading, empty, error, list and detail states. No billing query reads
identity's tables.

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
requests are cancelled when changing selection or leaving the page.
Role changes, suspension controls and deleted-account recovery are not part of
this read-only view. The public identity list currently has no pagination port;
pagination must be agreed with identity before growing that API.

`adminRoutes.test.ts` covers authorization before identity access, summary-only
responses, no-store on errors, invalid IDs, empty/missing results, sanitized
failures and unavailable identity. `adminIntegration.test.ts` proves that the
composition serves real identity summaries to a staff cookie, denies a member
cookie, and refuses forged stub credentials with real identity enabled.


### Retained ledger account labels

`GET /api/admin/ledger` adds a read-only staff ledger, with `limit` (1–100,
default 20), optional `cursor`, and `{ entries, nextCursor }`. It requires staff
before storage access, returns 503 without database or identity, and is no-store.
Rows explicitly contain `id`, `accountId`, `accountLabel`, `taskId`, `amount`
and ISO `createdAt`; free-text expense reasons and account email are omitted.
Pagination resolves `(created_at, id)` boundaries in SQL, retaining microsecond
precision. A missing boundary returns an empty page.

For each distinct owner on the bounded page, billing calls identity's public
`getAccount(id)`. Null yields **Deleted account**; a lookup failure remains an
error, not a deletion label. The Admin ledger displays the label and original
account ID. It never reconnects retained history to a new signup by email,
changes recorded amounts, or changes the account-detail endpoint's 404.
`adminLedger.test.ts` covers authorization, bounded pagination and lookup
failures; the composed admin integration test deletes a real account and signs
up again with the same email to prove the old ledger keeps its label and owner.


## Durable approvals (core #62)

Core/session owns `Charge.attemptId`, `BudgetApprovalResume` and durable waiting
operations. `app.ts` injects `session.approvals` into billing through a closure.
Billing reads no session tables. Migration 012 creates `billing_approvals` with
owner, task, attempt, checkpoint, SQL numeric estimate, reason, decision timestamps
and durable delivery state. Unknown cost is computed in SQL and displayed as
"one execution of unknown cost", never as a zero-dollar purchase.

- `GET /api/wallet/approvals` returns `{ approvals }`, at most 100 rows, pending
  first and then newest. Each owner sees only their own rows.
- `POST /api/wallet/approvals/:id/grant` and `/reject` return 202 with the saved
  decision. Both require the owner's identity, current spending eligibility and
  the configured exact Origin. Body account IDs never select an owner. Invalid
  IDs return 400, foreign/missing IDs 404, conflicting decisions 409.
- Repeating the same decision is idempotent. A row lock and conditional update
  atomically change pending to consumed (grant) or rejected and queue delivery.
  Here consumed means authorization committed for the attempt, not that work
  succeeded or finished. This follows #62's rule: the resume rechecks an attempt
  whose consumed approval allows it. Session consumes its own pending operation
  so repeated `requestResume` cannot run it again.
- The route plugin delivers queued decisions once a second, with a 30-second
  database lease and `SKIP LOCKED`. Non-404 delivery failures remain retryable;
  core's duplicate/missing/stopped-operation 404 is final. Closing the server
  clears the timer and drains delivery. A process restart resumes pending
  deliveries from SQL. A rejected decision also resumes the check, which denies
  and stops the task without running the worker even if the cap was later raised.

A consumed fan-out approval permits its child-open checks under the same account
and attempt ID. Other task/checkpoint combinations deny; a later operation has
a new attempt ID and cannot reuse it. Root estimate matching uses SQL numeric.
As in #62, this is not exactly-once external effects: a process failure after
session consumes its pending operation can leave work stopped. There is no
reservation and approval does not modify the account cap, credit or ledger.

Wallet includes an approval panel with approve/reject, refresh, loading, empty,
error and delivery-pending states. Delivery is not a promise of task success;
the session remains the source of its final outcome. The bounded list and
explicit refresh are the initial UI; pagination and live notifications are not
part of this increment.

`approvals.test.ts` covers durable request deduplication, owner/attempt binding,
concurrent grants/delivery, retries, terminal 404, rejection and exact decimal
matching. `approvalFlow.test.ts` uses real sign-in, HTTP routes and PostgreSQL to
prove waiting across restart, one resumed operation, a new approval for a later
turn, fan-out children without replaying parent spend, rejection despite a cap
increase, origin validation and account isolation. Missing approval dependencies
continue to fail closed rather than inventing non-durable approval records.


## Stripe test-mode top-ups

Core/PM approved the policy and exact server SDK dependency in
[#66](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-5892402930).
The offer is USD 5; each confirmed payment raises the cap by 5 in the same SQL
transaction as its receipt. Missing cap: 1 to 6; saved zero: 0 to 5. There is no
separate available balance, debit-on-spend or refund path. Expense records remain
unchanged. Identity still denies spending by suspended/deleted accounts. No
waiting task is automatically resumed by a payment; approvals remain explicit.

The public index exports `StripeConfiguration`, `stripeFromEnvironment(env)` and
`StripeTopups`. `main.ts` reads `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
`LUMEN_ORIGIN`; both secrets absent disables payments, partial configuration or
a non-test secret refuses startup. Keys never go to the browser or logs.
`app.ts` accepts `stripe?: StripeConfiguration`, requires real identity, a Db
and matching origin, and constructs the adapter for `topups?: TopupProvider`.
Only the server depends on `stripe` (exactly 23.0.0); the web has no new dependency.

- `POST /api/wallet/topups/checkout`: exact Origin, identity and `canSpend`;
  body `{ offer: "usd5", requestId: UUID }`. Owner, USD amount and return origin
  are selected on the server. The adapter opens hosted test Checkout, restricted
  to cards with adaptive currency conversion off. The browser receives only
  `{ url }`, and navigates to the verified `https://checkout.stripe.com` origin.
- `POST /api/billing/stripe/webhook`: bounded raw body, SDK signature verification
  (including timestamp tolerance), only `checkout.session.completed`. Both event
  and session must be test-mode. Only a complete, paid USD payment bound to our
  order is credited. Unrelated and unpaid events are acknowledged without credit;
  invalid signatures and payment mismatches return 400. The raw parser is scoped
  to this endpoint; other routes retain their normal JSON parser.
- `GET /api/wallet/topups`: owner-scoped `{ enabled, receipts }` with at most the
  newest 100 paid receipts. These are historical purchases, not an available
  balance. Reads are no-store. With no configuration checkout/webhook return 503.

Migration 013 stores orders and receipts separately from `ledger_entries`.
Persisting an order before calling Stripe gives each retry a stable idempotency
key; requests older than 23 hours or already paid return 409. A fresh request ID
means a new purchase. Row locks, checkout matching and payment-ID uniqueness
prevent duplicate credit across concurrent webhook deliveries or restarts.
Amount conversion, matching and cap addition all use PostgreSQL numeric.

A cap that cannot accommodate USD 5 within numeric(12,6) is rejected before any
provider call. The payment transaction also cannot partially commit if the cap
changes or other top-ups use the remaining numeric range during checkout: it
returns a retryable server error, with no receipt marked paid. For that exceptional
race, lower the cap to restore headroom and redeliver the same Stripe event.
No successful payment event is acknowledged while its accounting has failed.
This storage-ceiling check is not a spending reservation.

Wallet shows loading, disabled, checkout-in-progress, error/retry, cancellation,
return-awaiting-confirmation and receipt states. A return URL cannot write credit:
confirmation requires the server's receipt matching the returned order ID.
Refresh reloads both receipts and cap. The panel discloses test mode, no refunds
and forfeiture on account deletion. Existing cap editing and approval decisions
remain independent.

### Configuration and acceptance

Core reported staging secrets and the test endpoint configured in
[#66](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-5907003975).
The endpoint is `/api/billing/stripe/webhook` for `checkout.session.completed`.
Locally keep test secrets in an untracked `.env`; use the signing secret for the
actual endpoint or Stripe CLI listener being used. Do not paste keys in GitHub.

After merge/deploy, sign in on staging, note the cap, open Wallet and choose
"Add USD 5 in test mode". Complete hosted Checkout with a Stripe test card. Back
in Wallet, refresh until the matching receipt appears and verify the cap rose by
USD 5 while recorded spend stayed unchanged. Redeliver that event from Stripe's
test dashboard: receipt count and cap must not change. Cancel another checkout:
no additional receipt or cap change. A real Stripe test-account acceptance run
is separate from fixture CI and has not been claimed by this PR.

Verification: `stripe.test.ts` uses the official SDK to sign raw-body fixtures
and tests invalid/old/tampered signatures, live mode, unpaid/unrelated events,
fixed USD checkout, safe redirects, idempotency and sanitized provider errors.
`topups.test.ts` and `topupRoutes.test.ts` exercise PostgreSQL accounting, numeric
limits before provider calls, concurrency, rollback, eligibility and ownership.
`topupFlow.test.ts` composes real identity, billing and session: a zero-cap step
waits, a signed payment persists once across restart and a new step can run.
Run `docker compose up -d db` and `npm run verify` with `DATABASE_URL` set.
