# Identity delivery scope

Owner: LU YI. Evidence reconciled on 7 October 2026; implementation, merged
delivery and live acceptance are separate states.

## Delivered implementation

The identity delivery PRs [#23](https://github.com/ziyangliu-666/lumen-next/pull/23),
[#34](https://github.com/ziyangliu-666/lumen-next/pull/34),
[#37](https://github.com/ziyangliu-666/lumen-next/pull/37),
[#38](https://github.com/ziyangliu-666/lumen-next/pull/38),
[#40](https://github.com/ziyangliu-666/lumen-next/pull/40), and
[#47](https://github.com/ziyangliu-666/lumen-next/pull/47)–
[#51](https://github.com/ziyangliu-666/lumen-next/pull/51) are merged.

- Password authentication, shared-auth refresh and Account/Settings composition.
- Explicit GitHub/Google OAuth configuration and native-fetch provider clients;
  the deprecated Arctic dependency has been removed.
- Durable verification/reset mail queue, bounded admission/retries, worker
  lifecycle and recovery UI. Mail is disabled unless explicitly configured.
- Password change revokes other sessions. Account deletion tombstones the account
  and removes identity credentials, sessions and mail state transactionally.
- Account eligibility (`canSpend`) and value-free logging through core's logger.

On 3 October, the PM [confirmed on PR #38](https://github.com/ziyangliu-666/lumen-next/pull/38#issuecomment-5966506832)
that GitHub and Google sign-in both reach Account and the Sprint 3 OAuth outcome
is met. That happy-path acceptance does not establish every negative/logout/staff
case or real password-reset mailbox acceptance.

## Current work and remaining acceptance

| Goal | Status / remaining evidence |
| --- | --- |
| Account composition | Merged in #34; the old awaiting-merge gate is obsolete. |
| OAuth | Happy path accepted by PM on 3 October. Record any remaining live cancellation/conflict/logout/staff cases separately. Deployment owns HTTPS and private configuration. |
| Mail verification/recovery | Implemented and configurable. **Real mailbox verification/reset acceptance remains unconfirmed** in the records reviewed. A mock transport, outbox file, HTTP 202 or provider API success is not proof of receipt. |
| Account deletion | Merged in #49. Other slices' rows remain intact. The last staff account may delete itself; restoring staff access requires an authorized operational procedure, not automatic promotion. |
| Key lifecycle | Identity transaction gate and deletion participant implemented on this branch, not merged or composed with Billing. See [integration agreement](KEY_LIFECYCLE.md). Storage stays off pending joint integration and restricted suspended-owner authentication. |
| Application acceptance | Record live staff routing and cross-account isolation; tests alone are not browser acceptance. Existing WebSockets retain their handshake principal until shared-core revalidation exists. |
| Final DOD | Revision-specific green verification, owner review, CI/security/deployment gates, remaining live acceptance, final design/report/presentation evidence. No unsupported completion percentage. |

## Mail acceptance procedure (not yet executed)

Use an explicitly authorized disposable test account/mailbox on staging. Do not
reset a personal or teammate account without permission. Record date, revision,
environment and sanitized outcomes, never addresses, codes, cookies or secrets.

1. Request password recovery and confirm receipt in the actual inbox.
2. Redeem the code; verify new-password login and old-password rejection.
3. Check a previously issued session is revoked and the used code cannot replay.
4. Separately verify email verification delivery/redemption, and record relevant
   generic-failure and expiry cases.

The request is not marked complete until those observations are recorded. No live
reset or external mail was triggered during this documentation reconciliation.

## Verification and privacy

Historical local test counts are not current-HEAD evidence or feature completion.
Attach new test results to the tested revision/PR rather than treating old counts
as a delivery gate. Only source, synthetic fixtures and sanitized documentation
belong in the repository. Private credentials, OAuth identifiers, mailbox content,
profiles, captures, local databases and private reports stay out of commits.

Same-email provider accounts are not automatically linked. Retention decisions for
other slices remain their owners' responsibility; neither limitation is silently
reported as completed work.
