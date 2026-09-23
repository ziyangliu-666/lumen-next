# Queued mail delivery — design draft

Owner: LU YI. Status: implemented with this change; for core-owner review. Baseline: main `2613a84`.
Resolves the blocker in `MAIL_SETUP.md`: inline delivery makes response time
depend on whether an address is eligible (PR #15 S5).

## Problem

`MailActions.requestReset` does different work for different addresses:

| Address | Work before the 202 |
| --- | --- |
| Malformed | Validation only |
| Unknown, provider-only or suspended | One `select` |
| Eligible | `select`, a transaction with a row lock, an insert, then an awaited HTTPS call of up to 10 s |

Generic response text does not help when the eligible path is hundreds of
milliseconds slower. A second problem is that a failed send is lost: there is
no retry, and a 202 promises nothing.

## Goals

1. The public response does the same work for every well-formed address.
2. Delivery survives a process restart and is retried with a limit.
3. No plaintext code is ever stored; the code exists only in the outgoing mail.
4. Several processes can run the worker without sending twice.
5. Nothing in telemetry identifies an address, a code or a provider error.

Out of scope: bounce handling, exactly-once delivery (at-least-once with a
fresh code per attempt is acceptable), and mandatory verification at sign-in
(team policy).

## Design

### Admission (request path)

`POST /api/auth/forgot-password` and `POST /api/me/email/verification` validate
the input, then run **one insert** into `identity_mail_requests`:

```sql
insert into identity_mail_requests (purpose, email, account_id)
values ($1, $2, $3)   -- account_id only for authenticated verification
```

There is no account lookup on the public path. The route answers 202 as soon
as the insert commits. A worker, not the request, decides whether the address
is eligible.

The admission rate limit uses the existing `LoginGate` per peer, plus a
per-address cap counted in the same statement with the address hash, so the
query is identical for every address. A request above the cap is dropped
silently, still inside the same single statement:

```sql
insert into identity_mail_requests (purpose, email, email_key, account_id)
select $1, $2, $3, $4
where (select count(*) from identity_mail_requests
       where email_key = $3 and requested_at > now() - interval '1 hour') < 3
```

`email_key` is an HMAC-SHA-256 of the normalized address under a server key.
It lets the cap work without an index on plaintext addresses.

### Worker

`MailWorker` lives in the identity slice. It is started by the composition
root and stopped on shutdown, like the session kernel. Each tick:

1. Claim up to N due rows: `select … for update skip locked`, where
   `state = 'pending' and not_before <= now()`.
2. Resolve eligibility inside the same transaction: the account exists and is
   not suspended, and for a reset it has a password credential. If the address
   is ineligible, mark the row `done` and send nothing.
3. Generate a 32-byte code, store its hash in `identity_mail_tokens`
   (replacing any previous one; `unique(account_id, purpose)` already holds),
   and commit.
4. Send through `MailSender` outside the transaction.
5. On success, mark the row `done`. On failure, increment `attempts`, set
   `not_before = now() + 30 s × 2^attempts`, and delete the token hash from
   step 3, so an undelivered code can never be used.

A retry generates a new code. If a send actually succeeded but was reported as
failed, the user may receive two mails; only the newest code works.

The tick interval is 2 s with jitter. `skip locked` makes concurrent workers
safe. The queue is in PostgreSQL, so it is not an unbounded in-memory job.

### Limits and expiry

| Item | Value |
| --- | --- |
| Code lifetime | 15 minutes from the send, unchanged |
| Attempts | 5, then `failed` |
| Request lifetime | A row not sent within 1 hour becomes `failed` |
| Per-address cap | 3 per hour per purpose |
| Per-peer cap | Existing LoginGate |
| Cleanup | Each tick deletes `done`/`failed` rows older than 24 hours and expired token hashes |

### Revocation

- Suspension deletes the account's pending requests and outstanding token
  hashes in the suspension transaction. It currently only blocks their use.
- A password change already invalidates a reset code through the stored
  `password_hash`, and keeps doing so.
- An email change deletes pending requests and verification codes for the old
  address.

### Telemetry

These counters carry no labels that identify an address, a code or a provider
error:

- `mail.admitted`
- `mail.dropped_rate_limited`
- `mail.sent`
- `mail.retry`
- `mail.failed`
- `mail.ineligible`

Queue depth and the age of the oldest pending row are gauges. Provider errors
are logged only as the fixed string `Mail delivery failed`, as today.

## Schema

`009_identity_mail_queue.sql`, or the next free number when it merges:

```sql
create table identity_mail_requests (
  id           uuid primary key default gen_random_uuid(),
  purpose      text not null check (purpose in ('verify', 'reset')),
  email        text not null,
  email_key    text not null,
  account_id   uuid references accounts(id) on delete cascade,
  state        text not null default 'pending' check (state in ('pending', 'done', 'failed')),
  attempts     int  not null default 0,
  not_before   timestamptz not null default now(),
  requested_at timestamptz not null default now()
);
create index identity_mail_requests_due_idx on identity_mail_requests (not_before) where state = 'pending';
create index identity_mail_requests_key_idx on identity_mail_requests (email_key, requested_at);
```

A plaintext address is kept for at most 24 hours after the row is finished.

## What changes outside identity

These need core-owner review:

- `app.ts`: construct `MailWorker` when a `mailSender` is configured, and
  return it so `main.ts` can stop it.
- `main.ts`: read the mail configuration (sender key, from-address, HMAC key)
  and stop the worker before `db.close()` on SIGTERM.
- The migration file, in the shared migrations directory.

Everything else stays inside `modules/identity`.

## Tests

Written before the implementation; they fail against today's code:

1. **Admission is address-independent**: for unknown, eligible, suspended and
   provider-only addresses, the handler issues the same single statement and
   never calls `MailSender`.
2. **The worker sends to eligible addresses only**: an ineligible row becomes
   `done` with no send and no token.
3. **A delivery failure retries**: the row goes back to `pending` with a later
   `not_before`, and the undelivered code's hash is gone.
4. **The attempt cap**: after 5 failures the row is `failed` and
   `mail.failed` is counted.
5. **Replay**: a code consumed once fails the second time (existing test, kept).
6. **Revocation**: suspension removes pending requests and tokens, and a code
   issued before suspension fails after unsuspension.
7. **No double send**: two workers on one database claim disjoint rows.
8. **Restart**: a pending row admitted before a restart is sent after it.
9. **Cleanup**: finished rows older than 24 hours are deleted.
10. **Per-address cap**: the fourth request in an hour is dropped silently,
    with the same response.

## Decisions taken in this change (open to review)

- The worker runs in every process that has mail configured; `skip locked`
  keeps that safe.
- The HMAC key is a new variable, `IDENTITY_MAIL_KEY`, required whenever mail
  is enabled.
- Verification is queued too, so there is one delivery path.
