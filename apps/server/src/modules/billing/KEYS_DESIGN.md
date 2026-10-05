# Keys: encrypted storage proposal

Owner: HE RONG. This is the next UC5 increment after the read-only Admin spending
view. It does not change the completed Sprint 3 cap, approval or Stripe work.

## Current increment

`SecretCipher` is an internal, dependency-free adapter over Node's authenticated
AES-256-GCM implementation. It accepts an injected keyring with 32-byte keys and
an active key ID. Every write gets a random 12-byte nonce and 16-byte tag. AAD
binds the format version, key ID, account UUID and provider, so moving ciphertext
between accounts/providers or relabelling it fails authentication. Only `final()`
success releases plaintext. Errors contain fixed messages, without sensitive
values or nested crypto errors. Key material is kept in private `KeyObject`s.
See [Node crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html#ciphersetaadbuffer-options)
for the authenticated-encryption API; this adapter does not implement a cipher.

Envelope fields are `version`, `keyId`, `nonce`, `ciphertext`, `tag`; binary fields
use canonical base64. Values are bounded to 16 KiB of UTF-8. New writes use the
active key; old keys can remain in the injected ring for decryption. This is
rotation support, not an automatic re-encryption job. Tests use generated,
synthetic keys only. No real provider credentials are requested for this PR.

This increment does **not** expose a usable Keys page or secret retrieval port.
The current Settings placeholder remains a placeholder. The cipher is not wired
into the process, exported to another slice or advertised as a complete vault.

## Proposed next increment, pending owner agreement

- A billing-owned `billing_secrets` table, keyed by `(account_id, provider)`, with
  encrypted envelope and `updated_at`. Only core's numbered migration runner
  applies it. Core must allocate the migration number before the file is added.
- Core injects the keyring and active key ID from server-only Fly secrets in
  staging, and untracked local environment for development. Proposed names:
  `BILLING_SECRET_KEYRING` (JSON mapping key IDs to base64-encoded 32-byte keys)
  and `BILLING_SECRET_ACTIVE_KEY_ID`. These names and the provisioning/rotation
  procedure need core approval. No key value belongs in
  GitHub, logs, source, browser responses or acceptance evidence. Missing
  configuration disables the feature; malformed configuration fails startup.
- `GET /api/keys`: authenticated metadata only (provider and update time).
  `PUT /api/keys/:provider`: replace an owned value; exact Origin, bounded input,
  current identity eligibility. `DELETE /api/keys/:provider`: remove an owned
  value with the same authentication and Origin boundary. All responses no-store.
  No suffix, prefix or part of a saved key is returned, even to staff.
- `secret(accountId, provider)`: a trusted in-process port exposed through the
  billing public index only after consumer agreement. No HTTP plaintext read.
  Re-check identity eligibility at retrieval; never fall back to another owner's
  credential or silently use a platform credential after a decrypt failure.
- Settings Keys: configured/unconfigured metadata, add/replace/remove controls,
  clear entered values after submission, no localStorage persistence. Saving is
  storage only, not a claim that a provider credential works or a worker uses it.
- Agree provider IDs/value shapes with core and steering. Modal needs a credential
  pair; do not present a single-token field as a working Modal integration.
- Agree deletion cleanup with identity: deleted accounts must never decrypt;
  removing billing ciphertext needs a public deletion hook or agreed lifecycle
  mechanism, not direct access to identity tables. Suspension blocks use but need
  not erase the saved credential. Confirm the lifecycle before enabling storage.

## Acceptance for the complete feature

Real PostgreSQL persistence/restart; owner isolation; staff cannot read plaintext;
no credentials in metadata or errors/logs; exact-Origin mutation checks;
replacement and deletion; malformed/tampered envelope fails closed; old-key
rotation; missing configuration; and suspended/deleted account access denial.
Deletion cleanup and runtime provider use require explicit integration tests
against agreed public ports. `npm run verify` must pass with DATABASE_URL set.
