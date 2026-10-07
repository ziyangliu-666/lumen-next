# Identity / Billing key lifecycle agreement

Owner: LU YI. Proposed integration contract for [PR #79](https://github.com/ziyangliu-666/lumen-next/pull/79), 7 October 2026.

## Delivery boundary

This branch implements Identity's `withActiveAccount` port and optional
`onAccountDeleting` participant. It does not activate Keys, modify Billing,
wire the participant into composition, or implement suspended-owner HTTP proof.
Billing and core must review the integration below before activation. The
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

## Suspended-owner removal: proposed restricted authentication

Do not unsuspend the owner, revive revoked cookies, accept staff authority for
someone else's key, or relax `SessionPrincipalResolver`/`requireUser`. Ordinary
sign-in, key reads/saves, wallet access and account deletion remain unchanged.

The proposed next increment is a separate Identity-owned, removal-only flow:

- Purpose `billing-key-remove`, fixed provider `openai`, immutable owner derived
  from the verified credential, short expiry and atomic single-use redemption.
- Password: bounded input and LoginGate, current-password verification outside
  the lock, then credential-version recheck under the account lock.
- OAuth-only: separate purpose-bound state/PKCE attempt, matching an existing
  provider subject. No signup, email linking, normal login session or role grant.
- Exact Origin, no-store, generic refusal and value-free logs. No proof in URLs.
- Deleted owners fail. Suspended owners gain only authority to remove their own
  key. Proof consumption and Billing removal share one transaction; wrong purpose,
  owner/provider, stale credential, expired/replayed proof and old cookies fail.

This proof is **not implemented by this branch or PR #79**. Until reviewed and
implemented, no end-to-end suspended-owner removal is claimed and Keys stays
disabled. Allowing internal `remove()` for suspended accounts alone is not an
HTTP authentication solution. Billing must not invent an alternate login flow.
