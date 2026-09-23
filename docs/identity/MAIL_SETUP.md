# Mail verification and recovery

Mail is **off by default**: `GET /api/auth/mail` returns `{ enabled: false }` and
the verification and reset routes are not registered. main.ts turns it on only
through `mailFromEnvironment`:

| Variable | Meaning |
|---|---|
| `IDENTITY_MAIL_MODE` | `off` (default), `outbox` or `resend` |
| `IDENTITY_MAIL_KEY` | Required when enabled: 32+ printable characters, server-only HMAC key for the queue |
| `RESEND_API_KEY`, `MAIL_FROM` | Required for `resend`: the API key and a verified sender |

`outbox` writes each message to `.data/identity-mail-outbox/` next to the process
for local development and is refused in production. Configuration errors never
contain the values. With mail enabled, main.ts starts the identity mail worker
after listen and stops it before the database closes.

## Factory contract

`createIdentitySlice` takes `mailSender`, a server-only `mailKey` and an optional
value-free `mailEvent` callback, and returns `mailWorker`. Migrations 004 and 009
must be applied. The Resend adapter uses a fixed
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

## Known limits

- Delivery is queued (`MAIL_QUEUE_DESIGN.md`): a public request is one
  address-independent insert, and MailWorker resolves eligibility, retries up
  to 5 times with backoff, and cleans up. main.ts starts the worker when mail
  is configured.
- No bounce tracking or exactly-once guarantee: a retry sends a fresh code. A
  202 response does not prove mailbox delivery.
- Per-address admission is capped at 3 per hour per purpose, plus LoginGate per
  peer. Both are local to one database, not a distributed abuse service.
- Suspension purges outstanding recovery codes and pending requests.
- Core does not invalidate already-open WebSockets when login sessions change.

Unit tests simulate transport. Real PostgreSQL SQL/HTTP tests exercise purpose
binding, replay/expiry, replacement, changed-password invalidation, reset
revocation, unknown/provider-only/suspended accounts and transport failure.
These run with CI's DATABASE_URL, not PGlite. External verification and reset
acceptance must be performed separately with a consenting user's disposable
account after composition approval. This branch claims no real-provider delivery.
