-- Up Migration

-- API keys for the public API v1 (docs/platform/public-api.md, "API keys").
-- Only the SHA-256 of the whole key is kept: a leaked table must not hand out
-- working keys. The prefix is not secret; the key lists show it, so a person
-- can tell two keys apart.
create table platform_api_keys (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  name         text not null,
  prefix       text not null,
  key_hash     text not null unique,
  scopes       text[] not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index platform_api_keys_account_idx on platform_api_keys (account_id, created_at desc);

-- Down Migration

drop table platform_api_keys;
