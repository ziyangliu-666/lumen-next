# Keys: encrypted storage and integration

Owner: HE RONG. This is the next UC5 increment after the read-only Admin spending
view. It does not change the completed Sprint 3 cap, approval or Stripe work.

## Encryption foundation

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
The current Settings placeholder remains a placeholder. Startup validates the
keyring through the public configuration helper, but does not retain the cipher
for storage or provide a complete vault.

## Core decisions and persistence increment

Core approved the following in the [#77 review](https://github.com/ziyangliu-666/lumen-next/pull/77):

- Migration `015_billing_secrets`; only OpenAI is supported in this increment.
- `BILLING_SECRET_KEYRING` is JSON mapping IDs to canonical base64-encoded
  32-byte keys; `BILLING_SECRET_ACTIVE_KEY_ID` chooses the writer key.
- Core generates keys and provisions Fly secrets on staging; development uses an
  untracked `.env`. Add the new key, switch active ID, retain the old key until no
  row uses it. Never post values in source, GitHub, logs or acceptance evidence.
- The eventual public `secret(accountId, 'openai')` port is read by composition
  when building a worker's model. No saved key permits the existing platform key;
  decryption failure must stop the turn and must never fall back.
- **Until LU YI agrees the deletion lifecycle, storage stays off.**

Migration 015 creates only the billing-owned table: UUID owner and `openai`
provider primary key, encrypted JSON envelope and update timestamp. Generated,
indexed `key_id` supports checking which rotation keys remain in use. No account
or credential table from another slice is queried or modified.

The internal `Secrets` store provides metadata list, replace and trusted read.
Each operation accepts identity's transaction through `WithActiveSecretAccount`,
a structural port using only the public `IdentitySql` type. It has no pool access
and performs queries and decryption inside the callback; it returns only when the
outer lifecycle operation resolves. Only a missing row returns null. Concurrent
replacements use one SQL upsert.

The public `eraseAccountSecrets(accountId, tx)` and
`removeOwnOpenAiKey(accountId, tx)` functions delete only billing-owned rows in
the supplied transaction. They need neither a keyring nor spending eligibility.
The caller must authenticate the action, derive the owner and hold identity's
account lock; these callbacks are not authentication boundaries. Cleanup errors
propagate so identity can roll back the entire account deletion. Composition must
supply cleanup even when encryption configuration is absent.

LU YI supplied the lifecycle contract in
[#80](https://github.com/ziyangliu-666/lumen-next/pull/80) and the
[#79 handoff](https://github.com/ziyangliu-666/lumen-next/pull/79#issuecomment-6042496276).
Its `withActiveAccount` transaction and `onAccountDeleting` callback match these
billing ports. Identity also owns fresh password or purpose-separated OAuth
proof for suspended-owner removal. That implementation is still awaiting merge;
this adapter increment does not compose it or enable storage.

`secretCipherFromEnvironment(env)` parses explicitly supplied configuration and
returns a cipher, not raw key buffers. Both values absent/empty returns null;
partial or malformed configuration throws a value-free error. This helper is
exported by the billing public index and called by `main.ts` before database
initialization or listen, as requested in #78. Malformed configuration now stops
startup with a fixed error. The validated cipher is not wired into storage yet.

**No storage activation in this increment:** the internal `Secrets` store is
not exported by billing's public index or instantiated by
`createBillingSlice`/`app.ts`/`main.ts`. Only configuration validation is active.
There are no Keys routes and no worker lookup. The Settings placeholder is
unchanged; even provisioned environment variables do not enable storage yet.
The migration alone holds no user secrets. PostgreSQL fixtures instantiate the
store directly with generated synthetic keys to prove persistence and failure
semantics without collecting credentials from users.

## Remaining integration, after deletion agreement

- After #80 is reviewed and merged, compose its account-lock lifecycle and both
  cleanup callbacks through public indexes. Test actual ciphertext with real
  identity: save-before-delete removes it, delete-before-save rejects it, cleanup
  failure rolls back deletion, and suspension blocks retrieval. Contract fixtures
  alone do not prove these concurrent account lifecycle guarantees.
- `GET /api/keys` returns owned provider/update metadata only. `PUT` and `DELETE`
  `/api/keys/openai` require the authenticated owner and exact Origin. Writing
  and use require the active-account transaction. Suspended owners remove keys
  through identity's fresh-proof flow from #80, without a new session or restored
  spending eligibility. Reads are no-store. No prefix/suffix or saved value is
  returned, including to staff. Bounded input is validated before encryption.
- Settings Keys gets add/replace/remove controls, clears submitted values, never
  uses localStorage, and accurately describes provider usage. Only OpenAI is in
  scope; no Modal credential pair or other provider is advertised.
- Export the agreed `secret` port and configuration through billing's public
  index, wire identity cleanup and configuration in composition, and verify
  worker model selection with core. Saving alone is not runtime provider use.

## Acceptance for the complete feature

Real PostgreSQL persistence/restart; owner isolation; staff cannot read plaintext;
no credentials in metadata or errors/logs; exact-Origin mutation checks;
replacement and deletion; malformed/tampered envelope fails closed; old-key
rotation; missing configuration; and suspended/deleted account access denial.
Deletion cleanup and runtime provider use require explicit integration tests
against agreed public ports. `npm run verify` must pass with DATABASE_URL set.


Current tests: `secretConfiguration.test.ts` covers disabled/partial/malformed
configuration without value leakage. `secrets.test.ts` uses the real migration
and isolated PostgreSQL schemas to prove encryption at rest, metadata projection,
recreation, isolation, replacement/deletion, rotation, concurrent writes,
ineligibility, tamper rejection, save/removal rollback, outer lifecycle failure
propagation and keyring-independent cleanup of corrupt ciphertext. These are
transaction contract fixtures, not the joint identity lock acceptance tests. It also checks
that the composed application still has no Keys routes or public `secret` port.

`main.test.ts` launches the real compiled entry point with an isolated environment
to prove malformed/partial configuration fails before database setup or listen,
while missing/valid configuration reaches the normal startup checks.
