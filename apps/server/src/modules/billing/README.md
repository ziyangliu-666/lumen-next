# billing — HE RONG

**Use case:** UC5 — cap spend, authorise an expensive step, administer, pay
**Design pattern:** Chain of Responsibility

**Covers:** ledger, billing, secrets — the ledger, payment (Stripe), secret storage

The spend cap is checked before a turn, when a fan-out arrives, and when a window opens. A request over the cap is escalated to the user, not refused. Stripe checkout and invoices live here too.

## Boundary
Everything this slice exposes to the rest of the monolith is re-exported from
`index.ts`. Other slices import `modules/billing`, never a file inside it. You own
every file in this folder (see `/CODEOWNERS`).

## Definition of Done for a story here
See `/docs/DOD.md`. In short: a passing unit test on the behaviour, the pattern
demonstrated (brute-force version documented, then the refactor), lint and
typecheck green, and the CI pipeline green.
