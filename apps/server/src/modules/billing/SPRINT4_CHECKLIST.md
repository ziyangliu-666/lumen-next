# Billing Sprint 4 checklist

Owner: HE RONG. Started 12 October 2026; sprint dates are 13–24 October.
This is an execution checklist derived from docs/DOD.md, not additional product
scope approved by the PM. Open boxes are not claims of missing implementation.

## Carryover disposition

Core [waived the hosted Stripe dashboard replay on 12 October](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-6116352309)
and closed Billing Sprint 3 acceptance on the observed hosted payment/cancellation
and PostgreSQL replay tests. No dashboard replay occurred or is claimed.
Core owns the documentation update in #93; do not duplicate it in this branch.

## Design-pattern evidence

- [x] Submit conditional-baseline versus responsibility-chain evidence in #91.
- [x] Address owner feedback and merge #91 (core approved on 12 October).
- [ ] Incorporate the reviewed diagrams, ordering rationale, test mapping and
  concurrency limitations into the final team report and presentation.

## Integration and hardening

- [x] Audit framework-level rejection before Billing handlers. The shared
  `onSend` hook already sets API `no-store`; no runtime fix is necessary.
- [x] Add regression coverage for malformed JSON, unsupported content types and
  oversized requests at wallet cap, approval decisions and checkout routes;
  preserve the smaller raw webhook body limit. See `httpBoundary.test.ts`.
- [ ] Review the remaining account lifecycle, approval delivery, top-up and Keys
  interactions; turn concrete findings into focused fixes and regression tests.
- [ ] Complete final full-suite verification with PostgreSQL on the integrated
  main after implementation PRs merge; retain coverage of at least 70%.
- [x] Ask core to reconcile the shared coverage gate (accepted in the #94 review): docs require 70% for Sprint
  3/4 but `vitest.config.ts` currently enforces 65%. This is a shared-config
  discrepancy, not evidence that measured coverage is below 70%. Core owns the
  promised configuration change; its implementation remains to be verified.

## Hosted acceptance and demonstration

- [ ] Coordinate real hosted Keys/provider and fresh-proof OAuth removal
  acceptance with core/Identity. Synthetic credentials do not prove these flows
  against the live providers. Do not place real keys in evidence or the repo.
- [x] Prepare a repeatable demo procedure in `DEMO.md` (execution is still pending): recorded spend, over-cap waiting, grant/reject,
  test top-up, key management, staff role/suspension changes and retained history.
- [ ] Record environment and deployment version, expected/observed outcomes and
  limitations. Use dedicated test accounts; confirm the shared demo environment
  before changing roles, suspending accounts or making provider calls.

## Final delivery

- [ ] Confirm the team report template, contribution length and presentation time.
- [x] Prepare HE RONG's UC5 contribution in `REPORT.md` with responsibilities,
  architecture, pattern rationale, test evidence and known limitations.
- [ ] Obtain editorial review and incorporate it into the final team report.
- [ ] Rehearse the demo and answers about SQL numeric, idempotency, encryption,
  policy ordering and why a budget check is not a spending reservation.
- [ ] Resolve PR feedback, obtain owner review and green CI/security/deploy,
  synchronize documentation and record the final tested main revision.

Deferred product changes such as reservations, refunds and force-stopping running
workers require separate scope agreement; they are not implied by this checklist.
