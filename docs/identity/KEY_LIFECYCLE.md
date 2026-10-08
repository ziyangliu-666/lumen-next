# Identity / Billing key lifecycle agreement

Owner: LU YI. Proposed integration contract for [PR #79](https://github.com/ziyangliu-666/lumen-next/pull/79), 7 October 2026.

## Delivery boundary

This branch implements Identity's `withActiveAccount` port, optional
`onAccountDeleting` participant and optional fresh-credential key-removal routes.
It does not activate Keys, modify Billing, wire the callbacks into composition,
or provide the Keys UI. Billing and core must review and implement their owned
integration below before activation. The
existing `canSpend` port remains an unlocked eligibility snapshot, not permission
to perform a later secret write.

## Save, read and deletion serialization

`withActiveAccount(accountId, work)` owns a database transaction. Identity locks
the account row with `FOR UPDATE` and refuses malformed, missing, suspended or
deleted owners. It then awaits `work(transaction)` and reports success only after
commit. Exceptions, including commit failures, propagate. This is a trusted
in-process port, **not authentication**: an HTTP adapter must independently
establish the requesting owner and exact Origin.

Billing must use the supplied transaction for the entire save or retrieval,
including the ciphertext query and decryption. Do not query the outer pool,
open a nested transaction, retain the transaction after return, perform network
I/O, or lock a secret before the account. Lock order is account, identity proof
when required, then consumer-owned rows. All writers must follow this order.
Only an absent key for a still-eligible owner may return null; ineligibility or
crypto/storage failure must not fall back to the platform key. A read already
completed before suspension cannot revoke plaintext already in worker memory.

`createIdentitySlice({ onAccountDeleting })` accepts an awaited participant
`(accountId, transaction) => Promise<void>`. It runs after deletion proof has
been rechecked under the account lock, before the tombstone and identity cleanup
commit. Billing's participant deletes its own ciphertext on that same connection,
without decryption, keyring configuration or an eligibility check. Failure rolls
back both sides. Keep the participant wired even when key usage is disabled.
A tombstone does not cause FK cascading. This removes live rows, not backups/WAL.

If save holds the lock first, deletion follows and erases it. If deletion holds
the lock first, a later save fails eligibility. An asynchronous after-commit hook
or an unlocked `canSpend` followed by an upsert does not provide this guarantee.

### Owner handoff before enabling storage

- Billing: expose a keyring-independent eraser through its public index; use the
  Identity transaction port for saves and reads rather than a separate check.
- Core: inject the eraser into Identity before serving requests, compose Billing
  with `withActiveAccount`, and refuse enabled writes without lifecycle wiring.
- Joint tests: real Billing ciphertext, both save/delete orderings, rollback on
  either participant failure, other-owner isolation, suspension/read races,
  and cleanup with key usage configuration absent. Identity's fixture tests do
  not substitute for this composed acceptance.

## Suspended-owner removal: fresh, action-specific authentication

The optional `removeOwnOpenAiKey(accountId, tx)` factory callback enables the
following Identity routes. With no callback they are absent. Normal cookie
resolution and sign-in still reject suspension. No session is issued, account
created, email linked, role granted or suspension reversed by removal.

| Route | Proof / result |
| --- | --- |
| `POST /api/auth/key-removal/openai/password` | Exact Origin and bounded `{ email, password }`; fresh current-password proof; 204 on removal (including already absent). |
| `POST /api/auth/key-removal/openai/github` (or `google`) | Exact Origin and exactly `{ confirm: 'remove-openai-key' }`; 303 to the configured provider. |
| Existing `/api/auth/github/callback` (or Google) | `kr_` state dispatches only to removal, using a separate HttpOnly browser cookie and purpose-separated attempt hashes. |

Password verification happens before locking; the immutable owner, current email
and hash version are rechecked under the account lock before erasing. No caller
can supply an account ID or alternative key provider. Incorrect/unknown/deleted
proofs get the same generic refusal. LoginGate bounds attempts and expensive work.
A password is freshly verified per action, not converted into a reusable token.

OAuth uses the existing reviewed provider exchange and existing callback URL, but
not ordinary account resolution/session issuance. The start POST explicitly
confirms deletion. Attempts expire after ten minutes and are consumed before
exchange, so a repeated callback cannot retry the action. The returned immutable
provider subject must already be bound to a non-deleted owner and is rechecked
under its account lock. Email never establishes ownership. `signin` and
`key-removal` hash namespaces prevent either purpose being redeemed as the other.

There is no additional reusable proof to store or redeem: the fresh OAuth callback
completes the POST-confirmed action. Attempt consumption precedes the database
transaction; if exchange/cleanup fails, the user must start a new attempt rather
than reuse the old callback. The ciphertext removal itself is transactional.
This intentionally replaces the earlier proposed separate capability/redemption
API. The normal OAuth code/state travel in the callback URL; request logging is
silent there, responses are no-store/no-referrer, and passwords never enter URLs.

Success/failure redirects are fixed `/?keyRemoval=complete#/signin` and
`/?keyRemoval=failed#/signin`; they carry no credential or owner data. Provider
options are deployment-owned and cannot be chosen by an arbitrary callback URL.
The optional UI handoff still needs to render these states and explicit controls.

Tests exercise these routes with a real PostgreSQL database, synthetic credentials
and simulated OAuth providers. They prove auth isolation, purpose/binding/expiry
and replay refusal, rollback, other-owner isolation and stale-proof rejection;
they do **not** prove actual Billing ciphertext integration or live provider
acceptance. Keys stays disabled until owner-reviewed composition and acceptance.
Billing must not invent a replacement login flow.
