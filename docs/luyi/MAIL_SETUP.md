# Email verification, password recovery and delivery

Implementation checkpoint: 2026-09-18. Real verification delivery through Resend's
test sender and manual code submission succeeded: GET /api/me/email-status
returned 200 with verified=true. This proves the local verification flow only;
real password-reset delivery/submission and a production verified sender remain
pending. The local default is still a disk outbox unless Resend is explicitly configured.

## Public composition and code

- MailSender / IdentityMail and resendMailSender are exported from the identity
  public index. Core can inject any approved MailSender into createIdentitySlice.
- MailActions owns purpose-bound verification/reset codes and transactional use.
- Candidate migration 004_identity_mail.sql adds identity_mail_tokens and
  identity_email_verifications. Only these identity-owned rows cascade on account
  deletion; project/ledger data never does.
- mailDeliveryFailed is an optional value-free telemetry callback. Never log the
  message, recipient, code or provider response in that callback. Synchronous
  telemetry failures are isolated so they cannot change the generic mail response.
- RecoveryPanel.tsx is reachable from "Forgot password / email verification" on
  #/signin and from the local account panel. Canonical shell Settings integration
  remains an owner-reviewed follow-up.

## HTTP contract

All mutations require the exact configured Origin and share LoginGate limits.
Optional mail routes exist only when a MailSender is injected. Responses are
no-store. No route returns a code or mailbox contents.

| Route | Input/auth | Success |
|---|---|---|
| GET /api/auth/mail | public | `{ enabled: boolean }` |
| GET /api/me/email-status | current login | `{ verified: boolean }` for the current account email |
| POST /api/me/email/verification | current login | 202; send verification code if eligible |
| POST /api/me/email/verify | current login; `{ code }` | 204; verify only that account/email |
| POST /api/auth/forgot-password | `{ email }` | 202; identical generic response for unknown/ineligible/eligible addresses |
| POST /api/auth/reset-password | `{ code, newPassword }` | 204; password reset, all target login sessions revoked; no automatic login |

Wrong/expired/replayed codes and invalid input return 400; invalid login returns
401; untrusted Origin returns 403; local admission limits return 429. Unexpected
storage failures remain generic 500. A reset code cannot verify an email, and a
verification code cannot reset a password. Provider-only and suspended accounts
are ineligible for password recovery; the public response does not identify them.

## Code lifecycle and policies

- Generate 32 random bytes encoded as a 43-character URL-safe code.
- Store only its SHA-256 hash, purpose, target account/email, expiry, and (for
  reset) the credential hash version. Codes expire after 15 minutes.
- Issuing a replacement invalidates the previous code of that purpose. Expired
  rows are purged while issuing new codes; production also needs scheduled cleanup.
- Email contains a plain-text code and a fixed signin URL, not a code-bearing URL.
  The user pastes the code into the page. This avoids placing it in URL/referrer
  logs or browser storage; code inputs are cleared after a completed attempt.
- Consumption locks the active account first, verifies current email and expiry,
  and deletes the code in the same transaction as its effect. Reset also compares
  the credential version, changes the password and deletes all login sessions.
- A password or email change invalidates an earlier reset proof. Verification
  status is tied to the email string; changing email makes the new address
  unverified until its own code is confirmed.
- Verification is currently optional: unverified accounts can still sign in and
  use existing routes. Enforcing verification as an access gate is a separate
  team policy, not silently added here. Signup does not automatically send mail;
  request it explicitly from the recovery/verification UI.
- Provider-verified OAuth emails and this application's verification record are
  separate; OAuth signup does not populate identity_email_verifications yet.
- Suspension blocks code use while suspended but does not purge recovery codes;
  an unexpired code can be used after unsuspension. It never restores old login
  sessions. Decide whether administrative suspension should also revoke all
  outstanding recovery proofs before production release.

## Local disk outbox (default)

The local PGlite entry point applies migration 004 and injects a disk MailSender.
It saves messages under the ignored directory:

```text
tmp/identity-mail-outbox/<random-id>.txt
```

Open the message addressed to your disposable test account, copy its code and
paste it into the corresponding form. These files contain sensitive one-time
codes: do not commit, publish or share the directory. They are not exposed by the
HTTP server. Do not mistake local message generation for real mailbox delivery.

## Optional real delivery through Resend

The adapter uses native fetch, a fixed HTTPS endpoint, a ten-second timeout and
plain-text messages; no new application package was added. Core must approve
this provider or inject another MailSender. For explicit local external delivery,
privately set these environment variables before starting the server:

```text
IDENTITY_MAIL_MODE=resend
RESEND_API_KEY=<private server-side key>
MAIL_FROM=<verified sender address>
```

Default/unset IDENTITY_MAIL_MODE is outbox. Wrong modes or incomplete external
configuration refuse startup. Environment variables are not automatically loaded
from .env by this entry point. Never use VITE_* for credentials.

## Delivery guarantees and deployment limits

202 means the request was handled, NOT that mail reached the recipient. Delivery
failures use the same public forgot response and signal only the value-free
telemetry callback. Codes can be requested again after a transport failure.
There is no durable delivery queue, automatic retry, webhook/bounce tracking or
exactly-once delivery guarantee in this increment.

Transport calls currently run inline. Generic responses do not guarantee timing
indistinguishability; delivery latency can differ for eligible accounts. Before
public release, review enumeration policy, introduce a durable queue if required,
and enforce distributed/per-account as well as IP abuse controls. Signup already
exposes duplicate emails by policy; do not advertise full enumeration resistance.
Already-open WebSocket revocation is still a shared-core gap, including after
password reset. See CORE_HANDOFF.md.

## Validation

Unit tests exercise fixed-endpoint delivery, configuration validation and sanitized
errors with mocked provider responses. PGlite SQL/HTTP tests cover account-bound
verification, cross-account/purpose rejection, hashed storage, single use,
replacement/expiry, changed-password invalidation, reset session revocation,
unknown/provider-only/suspended addresses, transport failure and Origin rejection.

Real browser + local disk outbox checks verified an email and reset a password,
then confirmed the old session returns 401. On 2026-09-18 the user also received a
real verification email through Resend's test sender and submitted the code in
the browser. The follow-up GET /api/me/email-status returned 200 and verified=true.
No address, code, key or mail body is recorded here. Repeated-send/expired-code
regressions are exercised independently in the SQL/HTTP suite.

Real external password-reset acceptance is still pending. Use a user-controlled
password-based test account that is eligible for the configured sender. The current
OAuth-only account cannot reset a password, and must not be converted or linked
merely to make this test pass. The user enters passwords/codes only in the browser.
Confirm receipt, successful reset, old-session rejection, old-password rejection,
new-password login, and one-use code rejection without recording secrets. Reset
revokes every login session of that test account; obtain confirmation first.
Production deliverability and real PostgreSQL multi-connection behavior remain
separate deployment acceptance tasks.
