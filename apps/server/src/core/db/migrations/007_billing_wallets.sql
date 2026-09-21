-- Up Migration
create table billing_wallets (
  account_id text primary key,
  cap numeric(12,6) not null default 0 check (cap >= 0)
);
create index ledger_account_page_idx on ledger_entries (account_id, created_at desc, id desc);

-- Down Migration
drop index ledger_account_page_idx;
drop table billing_wallets;
