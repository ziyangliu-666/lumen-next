# Billing Sprint 3 acceptance

Owner: HE RONG. Audited 9 October 2026 against merged main
`6c9841a660b73ffd0da59ca4734fd879bd87a48b`.

Implementation is merged. Final hosted Stripe acceptance remains pending with
core; this document does not declare the full Sprint 3 DOD complete.

## Assigned outcomes and evidence

| Outcome | Delivered evidence | Status |
| --- | --- | --- |
| The displayed cap gates work; a new account has a usable default | [#55](https://github.com/ziyangliu-666/lumen-next/pull/55), [#56](https://github.com/ziyangliu-666/lumen-next/pull/56), [#59](https://github.com/ziyangliu-666/lumen-next/pull/59); `budgetChain.test.ts`, composed `app.test.ts` | Merged |
| Over-cap work waits for a durable owner decision, including restart and one-operation resume | [#62](https://github.com/ziyangliu-666/lumen-next/pull/62), [#64](https://github.com/ziyangliu-666/lumen-next/pull/64); `approvals.test.ts`, `../../approvalFlow.test.ts` | Merged |
| Stripe test-mode USD 5 top-up, durable receipt, SQL numeric cap update and replay protection | [#66](https://github.com/ziyangliu-666/lumen-next/pull/66); `stripe.test.ts`, `topups.test.ts`, `topupRoutes.test.ts`, `../../topupFlow.test.ts` | Merged; hosted payment and cancellation observed, dashboard replay pending |
| Retained ledger labels identify deleted owners without reconnecting by email | [#72](https://github.com/ziyangliu-666/lumen-next/pull/72); `adminLedger.test.ts`, `adminIntegration.test.ts` | Merged |
| Budget refusals use the shared logger with safe account/task/checkpoint/reason context | [#73](https://github.com/ziyangliu-666/lumen-next/pull/73); `budgetLog.test.ts`, composed `app.test.ts` | Merged |

The approval integration proves that over-cap work does not execute while waiting,
rejection never runs it even after a cap increase, and a grant resumes only the
bound operation. These are guard checkpoints, not reservations or interruption
of work already in flight. The existing README documents the precise policy;
no replacement implementation is needed for closeout.

## Additional delivered UC5 work

- Account spending in Admin: [#74](https://github.com/ziyangliu-666/lumen-next/pull/74).
- Encrypted Keys, lifecycle cleanup, runtime model selection and browser controls:
  [#77](https://github.com/ziyangliu-666/lumen-next/pull/77) through
  [#82](https://github.com/ziyangliu-666/lumen-next/pull/82),
  [#84](https://github.com/ziyangliu-666/lumen-next/pull/84) and
  [#86](https://github.com/ziyangliu-666/lumen-next/pull/86).
  Core approved the existing own-key Wallet accounting and disclosure in #86.
  Local synthetic-key tests are not hosted OpenAI or OAuth-provider acceptance.
- Staff role changes, suspension and restoration:
  [#87](https://github.com/ziyangliu-666/lumen-next/pull/87).
  Transactional authorization and concurrent demotion are tested. Self changes
  are refused; suspension revokes login sessions but does not kill running work.

## Remaining hosted acceptance — core owner

The [2 October observation](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-5945439466)
records a successful USD 5 hosted Checkout: cap 1 to 6, spend 0 and one receipt.
Cancellation added no receipt or cap. Core must still redeliver the paid event
from the Stripe test dashboard and record a 2xx delivery, the same one receipt
and unchanged cap. See the [9 October request](https://github.com/ziyangliu-666/lumen-next/pull/66#issuecomment-6064445349).

If the synthetic account has since changed, record actual before/after values.
A stable Wallet does not prove redelivery occurred. Fixture signatures and replay
tests cannot replace this hosted check. Do not request or commit signing secrets
as a shortcut. Close this item only with the core owner's observed result.

Identity owns the deletion disclosure; Billing adds no refund path and does not
present the spending cap as prepaid credit. Hosted Keys/provider acceptance is
tracked separately in [KEYS_DESIGN.md](KEYS_DESIGN.md), not claimed by this audit.

## Core replay checklist and result record

Action owner: LIU ZIYANG (`@ziyangliu-666`), confirmed in the
[#88 review](https://github.com/ziyangliu-666/lumen-next/pull/88).
Target: Sprint 3 closeout on 10 October 2026. Status: **pending**.
Keep the replay sign-off PR open until the observed result is recorded; a green
CI run or approval of these instructions is not a completed dashboard replay.

- [ ] Record the current cap, spend and receipt count for synthetic account
  `d441d055-daae-4e5f-92b7-0124d1643d1c` before replay.
- [ ] In the Stripe test dashboard, locate the paid `checkout.session.completed`
  event for Checkout
  `cs_test_a1KaUkVDWQuWyh5VkvnfRHGdYFfvBlELuQbU35UxQkVJd9VjVIgVil7BTW`.
  Redeliver that existing event to
  `https://lumen-next-staging.fly.dev/api/billing/stripe/webhook`.
  Do not create another purchase or substitute a newly signed fixture.
- [ ] Record the redelivery time and observed HTTP status; it must be 2xx.
- [ ] Refresh Wallet and confirm no extra receipt or cap increase. Order
  `f0236f89-def2-4702-b9ed-d516ef2e77af` must still have one confirmed receipt.
  With the original baseline, cap stays USD 6.0000 and spend USD 0.0000.
  If the account changed, compare and explain the actual before/after values.
- [ ] Post the result on #66 or the sign-off PR, fill the record below and link
  the evidence. Only then update the pending acceptance statements here and in
  the Billing README, and merge the sign-off record after review and green CI.

| Observed evidence | Result |
| --- | --- |
| Operator and redelivery time (include timezone) | Pending |
| Existing Stripe event ID and redelivery HTTP status | Pending |
| Cap before / after | Pending |
| Recorded spend before / after | Pending |
| Total receipt count before / after; matching order count | Pending |
| GitHub comment linking the observed result | Pending |

Record IDs and results only: no secret keys, signing secrets, cookies, payment
details or raw webhook body. If delivery fails or credit changes, leave the
checklist incomplete and report the failure for investigation.

## Verification

Use the existing local database service and isolated test schemas:

```sh
docker compose -p lumen-next up -d db
DATABASE_URL=postgres://lumen:lumen@localhost:5432/lumen \
  VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 \
  VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npm run verify
npm run build
```

Worker counts limit local resource contention; they do not filter out tests.

On 9 October, the audited main passed `npm run verify`: 113 test files passed,
one skipped; 1,040 tests passed and five skipped. PostgreSQL was configured, so
these skips do not represent disabling database acceptance. The two existing
lint warnings remain warnings, with no lint errors. Server and web production
builds also passed. Documentation corrections made by this closeout do not
change runtime code or test behavior. Closeout PR #88 is now reviewed and merged;
its checks and the subsequent main CI and staging deployment passed. That merge
does not complete the separate hosted replay acceptance above.
