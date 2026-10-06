-- Up Migration
-- Number allocated by core in #77. Runtime storage remains disabled until the
-- identity deletion lifecycle is agreed and wired through public ports.
create table billing_secrets (
  account_id uuid not null,
  provider text not null check (provider = 'openai'),
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  key_id text generated always as (envelope ->> 'keyId') stored not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, provider)
);
create index billing_secrets_key_id on billing_secrets (key_id);

-- Down Migration
drop table billing_secrets;
