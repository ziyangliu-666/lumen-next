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

The backend is composed when the keyring is configured and real Identity plus
PostgreSQL are available. Missing configuration leaves Keys HTTP storage off.
The Settings Keys page provides add/replace/remove controls. Hosted provider
acceptance remains a separate follow-up.

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
- The deletion lifecycle agreed in #80 is now composed with keyring-independent cleanup.

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
proof for suspended-owner removal. The lifecycle foundation (#79, #80 and #81) is merged. Composition wires both cleanup callbacks regardless of keyring configuration.
Configured storage requires real identity and a database before the server is built.

`secretCipherFromEnvironment(env)` parses explicitly supplied configuration and
returns a cipher, not raw key buffers. Both values absent/empty returns null;
partial or malformed configuration throws a value-free error. This helper is
exported by the billing public index and called by `main.ts` before database
initialization or listen, as requested in #78. `main.ts` now passes the validated
cipher to `composeApp`; it is never logged or sent to the browser.

## Runtime API and worker integration

`createBillingSlice` accepts optional `keys` dependencies: cipher, locked write
and shared-read lifecycle ports, and authenticated-owner removal. A database and
origin are required. Composition always injects Identity's deletion and fresh-proof
removal callbacks before constructing the store. The public slice's optional
`secret(accountId, provider)` is available only with configured storage.

- `GET /api/keys`: owner-only `{ keys: [{ provider, updatedAt }] }` metadata.
- `PUT /api/keys/openai`: exact Origin, authenticated owner, exactly `{ value }`,
  nonblank round-trippable UTF-8 up to 16 KiB, bounded 20 KiB JSON body; 204.
- `DELETE /api/keys/openai`: exact Origin, authenticated active owner, no body;
  idempotent 204. Suspended owners use Identity's fresh-proof removal routes.
- Keys responses are no-store, including validation errors. No saved value,
  suffix, prefix, envelope or key ID is exposed. Staff can access only their own
  key through these endpoints. Without configuration these routes remain absent.

`list` and `secret` use Identity's `withActiveAccountRead` (`FOR SHARE`); saves
use `withActiveAccount` (`FOR UPDATE`). Decryption completes under the read lock;
provider network calls start only after commit. Parallel readers can overlap,
while suspension and deletion still conflict with their account locks.

Composition wraps built-in demo and steering workers with an async account
context resolved from session's public directory. Every model call rereads that
account's saved key. A saved OpenAI key uses the existing OpenAI adapter with the
fixed `https://api.openai.com/v1` endpoint and `gpt-4.1-nano`; custom platform base
URLs cannot receive user keys. Only absence uses the configured platform model.
Storage, eligibility and decryption errors stop the call. Plaintext is not cached
between calls. Injected custom workers remain responsible for their own model
selection; production uses the built-in workers.

The Settings editor and sign-in removal controls are implemented. Identity's
OAuth initiation now returns `200 { url }` so a browser can POST JSON and then
navigate with `location.assign(url)`. The callback remains purpose-separated and
never signs in or unsuspends the owner. No live provider key or hosted OAuth
acceptance is claimed by synthetic integration tests.

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
that configuration-free composition still has no Keys routes or secret port.

`main.test.ts` launches the real compiled entry point with an isolated environment
to prove malformed/partial configuration fails before database setup or listen,
while missing/valid configuration reaches the normal startup checks.


## Eligibility error boundary

Following core review on #80/#81, the store translates Identity's public
`AuthFailure('invalid_credentials')` into core's fixed 403 `account cannot use keys`
for metadata, saves and retrieval. This denies missing, suspended and deleted
owners without exposing their state. Callers must propagate the rejection; only
an eligible owner with no saved row gets null and may use the platform fallback.
Other identity errors, SQL failures and decryption failures remain errors and are
not relabelled as access denial or absence.

`secretAccess.test.ts` proves the mapping for all three operations and preservation
of unrelated failures. Its real PostgreSQL test uses Identity's public factory
and HTTP authentication/deletion, showing suspended owners cannot overwrite or
read a saved key, reactivation retains the original value, and deleted owners
cannot access keys after deletion. Core composition now erases the ciphertext
in that same transaction; separate concurrency tests cover lifecycle ordering.

`keysIntegration.test.ts` exercises encrypted HTTP persistence across restart,
owner isolation, validation, both built-in workers, corrupt-ciphertext failure
without fallback, and fresh-proof removal with the keyring disabled.
`keysConcurrency.test.ts` observes real PostgreSQL lock contention for both
save/delete orders using actual ciphertext and proves cleanup rollback restores
both account and key. `accountModel.test.ts` checks parallel account contexts and
fresh lookup per call. Identity tests prove overlapping shared reads, suspension
blocking, JSON navigation responses over HTTP and purpose-separated callbacks.
