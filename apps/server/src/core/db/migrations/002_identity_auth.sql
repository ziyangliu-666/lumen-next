-- Up Migration

alter table accounts add column suspended boolean not null default false;

-- Keep the base exact-email constraint too. Existing normalized duplicates make
-- this migration fail; reconcile them explicitly instead of merging accounts.
create unique index identity_accounts_email_normalized_key
  on accounts (lower(btrim(email)));

create table credentials (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id),
  kind              text not null check (kind in ('password', 'github', 'google')),
  password_hash     text,
  external_provider text,
  external_id       text,
  created_at        timestamptz not null default now(),
  constraint identity_credentials_account_kind_key unique (account_id, kind),
  constraint identity_credentials_external_key unique (kind, external_provider, external_id),
  constraint identity_credentials_shape check (
    (kind = 'password' and password_hash is not null and length(password_hash) > 0
      and external_provider is null and external_id is null)
    or
    (kind in ('github', 'google') and password_hash is null
      and external_provider is not null and external_provider = kind
      and external_id is not null and length(external_id) > 0)
  )
);

create table auth_sessions (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint identity_auth_sessions_expiry check (expires_at > created_at)
);

create index identity_auth_sessions_account_idx on auth_sessions (account_id);
create index identity_auth_sessions_expiry_idx on auth_sessions (expires_at);

-- Down Migration

drop table auth_sessions;
drop table credentials;
drop index identity_accounts_email_normalized_key;
alter table accounts drop column suspended;
