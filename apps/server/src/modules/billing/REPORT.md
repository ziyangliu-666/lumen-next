# UC5: Money and administration — report contribution

Author: HE RONG. Prepared 12 October 2026 for the Sprint 4 team report.
This is a contribution draft ready for editorial review, not the final assembled
team report. Formatting and presentation duration remain subject to team agreement.

## Responsibility and architecture

UC5 is a vertical slice: Settings Wallet and Keys, Admin, HTTP authorization and
Billing persistence. HE RONG owns `modules/billing` and these page components.
Identity owns accounts, login and lifecycle locks. Session owns running tasks,
checkpoints, trace persistence and resumption. Core owns shared contracts,
configuration, database migration execution and application composition.

Calls cross slice boundaries through public indexes. Billing never queries
Identity or Session tables. Composition supplies account eligibility, account
administration, lifecycle callbacks and the approval resume port. The shared
`BudgetGuard` contract keeps Session independent of Billing's concrete policies.

## Implemented behavior

| Area | Delivered behavior | Evidence |
| --- | --- | --- |
| Wallet and ledger | Persist expense records; list history; display all-time spend and editable flat cap | #19, #20; Billing ledger/routes/integration tests |
| Budget policy | Default USD 1 cap, account eligibility, checks before turn/fan-out/task opening | #21, #53, #55, #56, #59; budgetChain and composed app tests |
| Durable approval | Persist a blocked attempt; approve/reject; retry delivery across restart | #64 with core #62; approvals and approvalFlow tests |
| Test-mode payment | Fixed USD 5 Checkout, verified webhook, receipt and cap update | #66; stripe, topups, topupRoutes and topupFlow tests |
| Admin | Account summaries, spending, retained ledger labels, role/suspension changes | #58, #72, #74, #87; admin integration and mutation tests |
| Keys | Authenticated encryption, owner-only management, lifecycle cleanup and per-account model selection | #77–#82, #84, #86; secrets, keysIntegration and keysConcurrency tests |
| Observability | Budget refusal context through the shared logger without charge text or credentials | #73; budgetLog tests |

These are team integrations, not a claim that HE RONG authored the core Session
or Identity implementation. PRs #62 and #80 supply dependencies from those owners.

## Design problem and selected pattern

The same spending rules apply at three checkpoints. Repeating conditional logic
at each caller would scatter policy order and failure handling. A shared
conditional function removes duplication, but every additional policy edits its
central decision tree. That is the illustrative baseline; it is not presented
as a historical implementation that was deployed and then removed.

The implemented Chain of Responsibility uses an ordered array of
`BudgetHandler`s. Returning `null` passes responsibility onward; any `Decision`
ends traversal. `BudgetChain` validates the estimate and denies if no handler
accepts. Account eligibility comes first. A stored approval then decides an
existing attempt, before a changed cap can override its rejection. SQL checks
whether new work fits. The final handler persists an escalation or denies if
durable approvals are unavailable.

A Strategy selects one alternative algorithm, whereas these rules cooperate in
sequence. The chain offers independently testable policies and extension without
changing callers. Its cost is indirection and order sensitivity: mandatory checks
must precede any handler that can allow. `budgetChain.test.ts` demonstrates a
fourth policy changing the outcome through the unchanged guard interface.

The dedicated design contribution is tracked in
[PR #91](https://github.com/ziyangliu-666/lumen-next/pull/91), including the flow
diagram and detailed test mapping. Core approved and merged it on 12 October.

## Persistence, numerical accuracy and failure handling

Money is stored as PostgreSQL `numeric(12,6)`. SQL performs addition and comparison;
JavaScript transports values and the browser formats them. The historical
`monthSpend` name now means all-time spend; there is no monthly reset. A missing
wallet row has a USD 1 default, while an explicitly saved zero stays zero.

The ledger writer can join Session's transaction so trace cost and expense either
both commit or both roll back. Budget checks do not reserve funds. Concurrent
checks or an already-running operation may exceed the cap; a checkpoint is not
a continuous enforcement mechanism.

Approvals bind account, attempt, task, checkpoint and estimate, with the agreed
fan-out child exception. A grant does not raise the cap. Durable delivery uses a
lease and retries; Session controls whether an operation can resume. This is not
an exactly-once guarantee for external effects after a process crash.

Stripe creates a persisted order and stable idempotency key before Checkout.
Only verified test-mode paid USD events can update accounting. Row locks and
payment identifiers prevent repeated credit; the receipt and numeric cap increase
commit together. The cap is not a prepaid balance. Refunds are outside the
implemented policy.

Keys use Node AES-256-GCM, random nonces and authenticated context binding owner
and provider. Metadata never exposes the saved key. Plaintext is read per model
call and is not cached between calls. Lifecycle locks serialize changes against
account suspension/deletion. Only no saved key allows platform fallback; an
unreadable saved key fails the call. Core holds encryption configuration outside
the repository.

## Validation and evidence limits

The repository gate is `npm run verify` with `DATABASE_URL`, plus owner review,
CI, security checks and deployment validation. The latest full results should be
attached to the final integrated main revision, not copied from an earlier branch
as if they covered later changes. Sprint 4 calls for at least 70% line coverage.

The hosted 2 October Stripe run observed a USD 5 payment raising cap from 1 to 6
with one receipt; cancellation added nothing. Core
[closed Billing Sprint 3 acceptance on 12 October](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-6116352309)
by waiving dashboard replay and accepting the hosted run plus PostgreSQL duplicate,
concurrent and restart tests. No dashboard replay occurred or is claimed.

Local synthetic-key and provider fixtures prove wiring and failure handling.
They do not establish real hosted OpenAI billing or live OAuth fresh-proof
removal. Those observations still require authorized hosted acceptance.

## Limitations and next steps

- The guard is not a spending reservation or a way to stop in-flight work.
- Staff suspension revokes login sessions; existing connections and running work
  are not forcibly terminated. Restoring an account requires fresh sign-in.
- Admin self-role/suspension changes are refused, but separate account deletion
  is not a global last-administrator guarantee.
- Own-key calls bill the owner's OpenAI account while Lumen still records their
  estimated cost and applies its cap, as approved in #86.
- Final team report layout, presentation timing and integrated demo acceptance
  remain coordination tasks. No new refund or reservation scope is implied.

## Presentation handoff

[DEMO.md](DEMO.md) supplies manual cases, a result sheet, presentation order and
likely questions. Its cases are procedures, not newly completed acceptance runs.
The team should adapt this contribution to its final report and slide template.
