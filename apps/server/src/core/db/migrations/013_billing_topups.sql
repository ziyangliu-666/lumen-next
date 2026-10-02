-- Up Migration
create table billing_topups (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  request_id uuid not null,
  amount numeric(12,6) not null check (amount = 5.000000),
  checkout_id text unique,
  payment_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, request_id),
  check ((paid_at is null) = (payment_id is null))
);
create index billing_topups_owner on billing_topups (account_id, created_at desc);

-- Down Migration
drop table billing_topups;
