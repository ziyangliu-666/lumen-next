# UC5 manual acceptance and presentation runbook

Owner: HE RONG. Prepared 12 October 2026. This is a procedure and recording
sheet, not evidence that these steps have already been performed.

## Prepare a controlled environment

Use an isolated local database for destructive cases. For hosted testing, agree
with core on staging configuration and dedicated disposable accounts. Use a
member, a second member and a staff operator; never alter the operator's own role
or use another person's real account. Core provisions staff and server secrets.

Record deployment commit, date/time with timezone, browser, operator and enabled
features. Settings may correctly show Keys or payments as unavailable when
configuration is absent. Mark those cases blocked, not passed. A working page
alone does not prove its provider integration.

Run `npm run verify` with DATABASE_URL for automated acceptance. For browser
acceptance open the configured application origin; the README documents local
startup and the hosted staging URL. Use the UI navigation rather than inventing
server paths for this hash-router application.

## Manual cases

| ID | Action | Expected observation |
| --- | --- | --- |
| W1 | Open Wallet on a new member | All-time spend starts at zero and the unsaved cap defaults to USD 1. Record actual values. |
| W2 | Run a small configured worker task, then refresh Wallet and ledger | Recorded task cost appears in spend and history. A zero-cost/no-model worker is not proof of paid accounting. |
| A1 | Set the disposable member's cap to zero; start a new project/task | New budget-checked work waits for approval instead of running. Wallet shows the pending operation. |
| A2 | Approve once; refresh approvals and view the session | The bound operation resumes if still runnable. The cap does not rise; delivery is not a promise that the model/task succeeds. |
| A3 | Create another blocked operation and reject it | It stops without executing. A later operation requires its own decision. |
| A4 | View approvals as the second member | The first member's approvals are absent. Do not reuse another person's credentials. |
| P1 | With Stripe test mode enabled, complete the fixed USD 5 test Checkout | One matching receipt appears and the cap rises by 5; recorded spend does not fall. Use test payment details only. |
| P2 | Open a separate Checkout and cancel | No extra receipt or cap increase. A return URL alone never proves payment. |
| K1 | With core-approved keyring/provider configuration, save a dedicated key in Settings | Only provider/update metadata is displayed; submitted input clears. Refresh never reveals the saved value. |
| K2 | Make an authorized small model call, replace the saved key, then make another call | Provider-side evidence confirms the appropriate key was used. UI metadata alone is insufficient. Never include key values in screenshots or notes. |
| K3 | Confirm key removal | Metadata becomes empty. Future calls use the configured platform model when available; do not assume removal cancels calls already sent. |
| K4 | Use Identity's fresh-password and configured OAuth removal flows while signed out | Removal succeeds only with the correct owner proof and does not sign in or unsuspend the owner. Record each provider separately. |
| M1 | Staff opens a disposable member's account details | Safe account fields and wallet figures are visible; ordinary members cannot access Admin. |
| M2 | Staff changes the disposable target's role, then restores it | New authenticated requests observe the changed role. Self controls are unavailable. |
| M3 | Staff suspends the target, then restores it | Old login stops working; restoration requires fresh sign-in. Do not expect existing sockets or in-flight work to be terminated. |
| D1 | Delete a disposable member that has a recorded ledger entry | Admin ledger retains the original owner ID with a Deleted account label. Account details are unavailable. |
| D2 | Register again with that same disposable email | The new account does not inherit the old ledger, key or approvals. |

For A1–A3, provider/worker failures must be distinguished from budget decisions.
Use the actual session state and ledger, not just an approval button response.
For K2, the provider account owner must authorize usage and any resulting charges
before testing. Synthetic-key fixtures are an alternative for local wiring tests,
not a substitute observation for this hosted case.

## Record results

Copy one row per executed case; leave unexecuted cases pending.

| Case | Deployment/environment | Operator/time | Before and after | Pass / fail / blocked | Evidence or issue |
| --- | --- | --- | --- | --- | --- |
| Not yet executed in this runbook | — | — | — | Pending | — |

If a response is lost after a mutation, refresh saved state before retrying.
Do not record secrets, cookies, raw payment bodies or personal card data.
Clean up only the dedicated fixtures you own, after retaining necessary evidence.
Do not delete the historical Stripe acceptance account as routine cleanup.

## Suggested presentation sequence

Adapt this outline to the team's allotted time; no duration has been agreed.

1. **Responsibility:** Wallet, Keys and Admin; show the public ports to Identity
   and Session and distinguish personal work from shared core work.
2. **Design problem:** three checkpoints must apply the same policies. Contrast
   the illustrative repeated conditional with the implemented responsibility chain.
3. **Pattern evidence:** explain `null` delegation, first-decision short circuit,
   eligibility before stored approval, and why a rejected attempt precedes cap.
4. **User flow:** show over-cap waiting and an approval/rejection, then the Wallet
   result. Use prepared test evidence if a live provider is unavailable.
5. **Hardening:** show SQL numeric accounting, duplicate-payment tests, encrypted
   key ownership and lifecycle regression. Explain the limits honestly.
6. **Contribution and status:** show reviewed PRs, the tested revision and remaining
   hosted acceptance, without calling an open PR merged.

## Likely questions and concise answers

- **Why not Strategy?** Multiple policies cooperate in order rather than choosing
  one interchangeable algorithm.
- **Can an approval bypass suspension?** No. Eligibility is checked first, before
  the stored approval. This does not cancel work already in flight.
- **Does the cap guarantee total spend never exceeds it?** No. It gates known
  checkpoints without reserving funds for concurrent or unknown-cost work.
- **Why SQL for money?** The persisted decimal calculation and comparison use
  PostgreSQL numeric, avoiding separate JavaScript arithmetic policy.
- **Can a repeated webhook charge twice?** Accounting locks and persisted payment
  identity make repeat credit idempotent; tests cover concurrency and restart.
- **Was Stripe dashboard replay performed?** No. Core waived it on 12 October,
  accepting the recorded hosted payment/cancellation and database tests.
- **Can an administrator read a saved key?** The API exposes metadata only and
  key management is owner-scoped. Encryption configuration stays with core.
- **Is a top-up a refundable wallet balance?** No. Current policy increases a cap;
  it does not reduce spend or implement a refund/balance ledger.
