# Identity persistence increment

## Scope and boundary

Implement PostgreSQL account and login-session stores and a composition factory
inside identity. Core currently has only schema.sql: no pool, query API, migration
runner or pg dependency. Do not create a competing pool, add an unreviewed server
dependency, edit main.ts, or use an in-memory store in production.

IdentityDatabase is a small injected SQL/transaction port, not a database runner.
Core's eventual adapter supplies parameterized queries and transactions on one
connection. The SQL migration is a review candidate under identity/migrations;
the core owner assigns its final number and applies it with the shared runner.
The factory supplies the resolver and Fastify plugin for main.ts to compose.

## Decisions

- Preserve the current HTTP paths and core error envelope. No silent contract
  change; design.docx/API.md are historical designs, not the runtime contract.
- Enforce normalized email uniqueness in PostgreSQL, including concurrent writes.
  Do not rewrite or merge existing accounts: migration fails if normalized email
  duplicates already exist, requiring explicit reconciliation.
- Signup creates account and password credential in one transaction; a credential
  failure rolls back the account. Session issuance remains a separate operation.
- Sensitive account writes lock the account first, then the password credential.
  Compare the password proof after taking these locks. Name-only updates also
  check suspension on the locked account. All future account mutation adapters
  must retain this lock order.
- Store session hashes only. Session verification joins current account role and
  suspension; revoke-one/all delete durable rows. No session renewal per request.
- SQL parameters are never interpolated. Translate only the base accounts_email_key
  and identity_accounts_email_normalized_key violations to email_taken; other
  failures propagate.
- No account deletion/cascade of projects or ledger data, OAuth auto-linking,
  role-management public API or mail transport is invented in this increment.

## Implementation and acceptance

1. Write tests for the store query contracts and transaction behavior first.
2. Add the migration, SQL port, stores and createIdentitySlice factory.
3. Test factory wiring through Fastify: signup, password login, me, changes,
   cookie-only resolution and revocation. Clearly label any test doubles.
4. Run targeted tests, full npm run verify and build. Record separately whether
   SQL was executed by a PostgreSQL engine; mock query tests are not database
   acceptance tests and cannot prove concurrency behavior.
5. Update the public README and implementation checkpoint. Do not claim durable
   application login until the shared pool, migration runner and main.ts wiring
   exist and a live-database integration test passes.

## Required owner follow-up

LIU ZIYANG: approve the port mapping to core, dependency/runner, migration number,
normalized uniqueness and suspended account flag, then wire the factory in main.
Test against PostgreSQL 17 with concurrent signup and credential changes, rollback,
restart persistence and HTTP/WebSocket identity. Keep the development stub out of
real deployment. HE RONG: coordinate Account tab ownership separately.
