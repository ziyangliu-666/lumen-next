# Account deletion — technical draft

Owner: LU YI. Status: draft; blocked on the retention policy below. Baseline: main
`2613a84`. No endpoint or UI is enabled by this document.

## What the schema allows today

| Table (owner) | Reference to `accounts` | Effect of `delete from accounts` |
| --- | --- | --- |
| `projects` (projects) | uuid FK, no cascade | **Fails** while the account has a project |
| `credentials`, `auth_sessions` (identity) | uuid FK, no cascade | Fails unless identity deletes them first |
| `identity_mail_tokens`, `identity_email_verifications`, `identity_mail_requests` (identity) | FK, `on delete cascade` | Removed |
| `sessions`, `tasks` (session) | `account_id text`, no FK | Rows survive, pointing at nothing |
| `ledger_entries`, wallets (billing) | `account_id text`, no FK | Financial rows survive, orphaned |

A hard delete therefore either fails or leaves research and money records
orphaned. Identity cannot decide which of those is correct for another slice's
data.

## Proposal: anonymize, keep a tombstone

`DELETE /api/me` does not remove the `accounts` row. In one transaction, under
the account-first lock order every credential change uses:

1. Verify recent authentication (below).
2. Set `email` to a unique non-deliverable placeholder
   (`deleted+<id>@invalid`), set `display_name` to `Deleted account`, set
   `suspended = true`, and add `deleted_at = now()` (new identity migration).
3. Delete `credentials` (password and OAuth), so the provider identity can sign
   up again as a new account.
4. Delete `auth_sessions`, `identity_mail_tokens`, `identity_mail_requests`
   and `identity_email_verifications`.
5. Call each slice's deletion port (below) inside the same transaction.

Foreign keys stay valid, the ledger keeps its account id for audit, and nothing
can sign in as the account again. The tombstone never appears in admin listings
unless billing asks for it.

## Per-slice deletion port

Identity does not write other slices' SQL. The composition root passes
`onAccountDeleted: (sql, accountId) => Promise<void>[]`, and each slice decides
what it does with its own rows:

| Slice | Question for its owner |
| --- | --- |
| projects | Delete projects and findings, or keep them anonymized? |
| session | Stop running tasks and delete the trace, or keep it for cost audit? |
| billing | How long are ledger entries retained, and is a positive balance refunded or forfeited? |

## Recent authentication

- Password accounts: `currentPassword` in the request body, verified like
  `POST /api/me/password`.
- OAuth-only accounts: the session must have been issued within the last
  10 minutes. This needs an `issued_at` check on `auth_sessions`, which already
  stores `created_at`.
- LoginGate applies per peer and per account, as for password changes.

## Active work and revocation

- A running session must be stopped before anonymization, or the worker would
  keep spending on a deleted account. Session's port answers "stop all tasks
  for this account" and waits for the kernel to acknowledge.
- Cookies stop working immediately, because `auth_sessions` rows are deleted
  in the transaction.
- **Open WebSockets keep their handshake principal** until core adds
  revalidation. That is a core change and a known limit of suspension too; the
  endpoint must not claim to close sockets until it exists.

## Reversibility

The tombstone makes a grace period cheap: keep the original email in a
separate, identity-owned `identity_deletion_holds` row for N days, and restore
it if the user signs back in with a new login. Whether to offer this is a
policy decision; the default in this draft is **irreversible**.

## Tests to write first, once the policy is fixed

1. Wrong or missing reauthentication leaves every row unchanged (401).
2. After deletion: `/api/me` is 401 for every old cookie, sign-in fails, and
   the email and provider identity can sign up as a fresh account.
3. Deletion racing a password change or a new login: exactly one wins, and no
   session survives (the lock-order tests already used for reset).
4. A slice port that throws rolls the whole deletion back.
5. Ledger rows keep their account id; projects follow the projects owner's
   answer.
6. A staff account cannot be deleted through `/api/me` while it is the last
   staff account (to be confirmed with billing, who own admin).

## Decisions needed from the team

1. Anonymize with a tombstone (this draft) or hard delete?
2. For each slice, what happens to its rows (table above)?
3. Is there a grace period, and how long?
4. Who may delete: only the user, or staff too, from the admin page?
