# Vertical slices

One person owns a slice end to end: the pages a user sees, the back-end module
behind them, the design problem it solves, and the pipeline jobs for it. The rule
that keeps five people from colliding: **implementation ownership follows design
ownership.**

## The shared contract (LIU ZIYANG)

`packages/contracts` and `apps/server/src/core`. The domain model (task, step,
session), the server→browser event protocol, the base database schema, and
the auth guard every route passes through. Fixed at the end of Sprint 1. After
that, a change here is a reviewed pull request, because every slice depends on it.

## UC1 — Identity (LU YI)

- Pages: 02 Sign in / sign up, 05 Settings → Account.
- Module: `modules/identity`. GitHub OAuth, Google OAuth, email + password, and an
  existing session — four ways in, one principal out.
- Design problem: four exchanges differ, all must end in one session, and a fifth
  must not change the flow. Candidate pattern (proposal 6.4, the owner confirms
  after comparing candidates): **Strategy + Template Method**.
- Note (review): admin is not a separate hidden login. A staff account signs in on
  the same page and is routed to `/admin` by role.

## UC2 — Projects (PENG XUJIAN)

- Pages: 01 Landing, 03 Home.
- Module: `modules/projects` (+ findings list).
- Design problem: a project card renders and refreshes differently when running,
  waiting, finished or stopped; the logic must not scatter. Candidate pattern
  (proposal 6.4, the owner confirms after comparing candidates): **State**.

## UC3 — Session (LIU ZIYANG)

- Page: 04 Session — the call tree, the step list.
- Module: `modules/session` (kernel + broker).
- Design problem: a task and a subtree of tasks answer cost, cancellation and
  rendering the same way; cost rolls up through the tree. → **Composite**.

## UC4 — Steering + sandbox (LI ZHUOYANG)

- Page: 04 Session — the composer and the files panel.
- Module: `modules/steering` (worker, compute, storage).
- Design problem: a user message is queued and applied at a chosen moment in a
  running turn, undoable before it lands; the compute provider is replaceable,
  including one that does nothing. Candidate pattern (proposal 6.4, the owner
  confirms after comparing candidates): **Command**, compared with Strategy and
  Null Object.

## UC5 — Money + admin (HE RONG)

- Pages: 05 Settings → Wallet and Keys, 06 Admin.
- Module: `modules/billing` (ledger, billing, secrets).
- Design problem: the spend cap is checked before a turn, at fan-out, and at window
  open; an over-cap request is escalated to the user, not refused; a new check point
  must not change the callers. Candidate pattern (proposal 6.4, the owner confirms
  after comparing candidates): **Chain of Responsibility**.
- Note (review): a Stripe top-up + invoices page belongs here.

## Sequencing

Sprint 1 is the whole team on the shared contract. Identity ships first, because
every slice needs a signed-in user; the others develop against the sign-in stub in
`core/http/authGuard.ts` until it lands.
