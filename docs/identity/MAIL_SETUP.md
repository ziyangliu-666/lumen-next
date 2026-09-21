# Mail verification and recovery: not wired

`MailActions`, `MailSender`, `IdentityMail` and `resendMailSender` are implemented.
**main.ts injects no mailSender**, so verification and password-reset routes are
not enabled in this Sprint 2 PR. `GET /api/auth/mail` returns `{ enabled: false }`.
There is no active disk outbox or environment-driven mail composition.

## Optional factory contract

An owner-reviewed composition can inject `mailSender` and an optional value-free
`mailDeliveryFailed` callback. Apply the shared runner's
`core/db/migrations/004_identity_mail.sql` first. The Resend adapter uses a fixed
HTTPS endpoint, native fetch, plain-text messages and a ten-second deadline.
Configure a verified sender and server-side credentials privately; never record
mail bodies, recipients, codes or provider error details in telemetry.

| Optional route | Input | Result |
|---|---|---|
| GET /api/me/email-status | authenticated | verification state for current email |
| POST /api/me/email/verification | authenticated | 202, request verification |
| POST /api/me/email/verify | authenticated, code | 204 |
| POST /api/auth/forgot-password | email | 202, generic eligibility-independent text |
| POST /api/auth/reset-password | code, newPassword | 204, revoke all sessions, no automatic login |

Mutations require exact Origin. Codes contain 32 random bytes; only hashes are
stored. Codes are purpose/account/email-bound, expire after 15 minutes and are
consumed transactionally once. Replacement invalidates prior codes. Reset checks
the old credential version and updates password, consumes proofs and revokes
sessions in one transaction. Email changes invalidate old verification status.
Unverified accounts are not blocked from signing in; enforcement needs a team
policy. OAuth verified emails do not automatically populate verification records.

## Blockers before enabling delivery

- Delivery is currently awaited inline for eligible addresses. Although response
  text is generic, timing may reveal account eligibility (PR #15 S5). Implement
  an owner-reviewed queued delivery design before enabling public reset routes.
- No durable retry, delivery queue, bounce tracking or exactly-once guarantee is
  implemented. A 202 response does not prove mailbox delivery.
- Review distributed/per-account mail abuse controls and cleanup scheduling.
- Decide whether suspension must revoke outstanding recovery proofs. It blocks
  their use while suspended but does not purge them.
- Core does not invalidate already-open WebSockets when login sessions change.

Unit tests simulate transport. Real PostgreSQL SQL/HTTP tests exercise purpose
binding, replay/expiry, replacement, changed-password invalidation, reset
revocation, unknown/provider-only/suspended accounts and transport failure.
These run with CI's DATABASE_URL, not PGlite. External verification and reset
acceptance must be performed separately with a consenting user's disposable
account after composition approval. This branch claims no real-provider delivery.
