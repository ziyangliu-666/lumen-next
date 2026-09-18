# billing — HE RONG

**Use case:** UC5 — cap spend, authorise an expensive step, administer, pay
**Covers:** ledger, billing, secrets — the ledger, payment (Stripe), secret storage

## The design problem (from the proposal, section 6.4)

The spend cap is checked before a turn, when a fan-out arrives, and when a task
opens. A request over the cap must be escalated to the user for approval, not
refused. A new check point must not change the callers. Stripe checkout and
invoices live here too.

**Candidate pattern:** Chain of Responsibility. This is the starting hypothesis
from the proposal, not the conclusion. You compare the candidates, pick one, and
write down why.

## Implemented read-only administration boundary

`createBillingSlice({ accounts })` accepts identity's public `AdminAccounts`
interface and registers staff-only account list/detail routes. Both routes call
`requireStaff`, return only identity's safe `AccountSummary`, disable caching,
and validate account UUIDs before calling identity. This first increment exposes
no role, suspension, kill-switch, invitation, billing, or secret mutation.

The spend-cap, payments, secrets, and mutation policies still require the slice
owner's design. Write those flows and the Chain of Responsibility comparison
before implementing them; the read-only account boundary does not decide those
policies.

## Boundary

Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/billing`, never a file inside it. You
own every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here

See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
