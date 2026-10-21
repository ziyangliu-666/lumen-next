# Hosted approval acceptance on 21 October

Target: `https://lumen.54-179-112-87.sslip.io`.
Window: 07:46:46–07:46:55 UTC (15:46 Singapore time).

[Deployment 39562523797](https://github.com/ziyangliu-666/lumen-next/actions/runs/39562523797)
succeeded at `e4fef488eddb7660d04d98e4251cfe568fab1254`, which includes merged
[PR #148](https://github.com/ziyangliu-666/lumen-next/pull/148). Verify, SCA,
SAST, image scan/deploy and DAST passed; demo-only k6 smoke was skipped in
steering mode. CI and Security also passed at this SHA.

## Procedure and observed results

A dedicated acceptance account was created through public signup. Its cap
was set to zero and its wallet initially showed zero spend. No existing
account, deployment setting, provider credential or staff permission was
changed. Two projects used this prompt:

> Reply with APPROVAL_ACCEPTANCE_OK only. Do not delegate, search, run commands, or use any tools.

Both roots first reached `waiting` with zero spend and a pending approval.
Decisions were sent through the public Wallet endpoints with the owner's
cookie and the matching Origin. Status and ledger evidence came from the
public session, wallet and approval endpoints.

| Check | Reject | Grant |
|---|---|---|
| Session | `dfa88a10-a424-45bd-a684-7d2bb8b9d612` | `a07c0868-3a23-4ec9-a5df-fa01438b4d20` |
| Task | `9ee7fc6b-10d7-4ab8-bdd8-4c35d5d08fe6` | `761a569e-3bac-4c04-b615-0adeaa5daa3d` |
| Approval | `4e54a872-1350-425a-8864-036dba10a057` | `21422a5f-197e-4588-98fa-82c13d78265f` |
| State transition | waiting → stopped | waiting → ended |
| Durable decision | rejected | consumed |
| `resumePending` after delivery | false | false |
| Session spend | USD 0 | USD 0.000121 |
| Worker result | “Not run: approval rejected.”; no model step | `APPROVAL_ACCEPTANCE_OK`, model `gpt-4.1-nano-2025-04-14` |

The grant produced two ledger records for its task: USD 0.000110 and
USD 0.000011. The server returned Wallet spend USD 0.000121, identical to
the session total. The cap remained zero. An approval authorizes that
operation; it does not raise the saved cap.

Repeating the grant returned 202. After 2.5 seconds, step count and session
spend were unchanged. Both tasks were terminal when the check ended; no
pending approval was left. Credentials were held only in memory and are
absent from the evidence. The dedicated test account and records remain for
traceability.

## Scope and limits

This closes the hosted normal grant/reject path through public ingress,
billing delivery, session and the configured worker. It does not simulate
a pod outage, establish exactly-once execution under all failures, or prove
capacity. The isolated Postgres/real-HTTP tests in
`2026-10-21-approval-http.md` cover retry after a billing restart and the
30-second delivery lease separately.

`GET /api/wallet/topups` returned `enabled: false`. Stripe implementation
and local tests are present, but hosted Stripe Checkout/webhook acceptance
is not complete on this deployment. Enabling it requires the core owner's
test-mode configuration; no payment or top-up was attempted here.
