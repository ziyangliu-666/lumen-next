-- Up Migration

-- Account deletion keeps the accounts row as an anonymized tombstone, because
-- projects, sessions and ledger entries in other slices still name its id.
-- This touches core's shared accounts table, like 002 did, with core's
-- agreement: one nullable column and one check, nothing else.
alter table accounts add column deleted_at timestamptz;

-- A tombstone is always suspended, so no path that clears suspension (staff
-- unsuspend included) can make a deleted account usable again.
alter table accounts add constraint identity_accounts_deleted_suspended
  check (deleted_at is null or suspended);

-- Down Migration

alter table accounts drop constraint identity_accounts_deleted_suspended;
alter table accounts drop column deleted_at;
