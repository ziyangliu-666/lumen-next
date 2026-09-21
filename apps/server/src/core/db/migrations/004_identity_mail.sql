-- Up Migration

-- Only identity-owned records cascade on account deletion.
create table identity_mail_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  account_id uuid not null references accounts(id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  email text not null,
  password_hash text,
  expires_at timestamptz not null,
  unique (account_id, purpose)
);
create index identity_mail_tokens_expiry_idx on identity_mail_tokens (expires_at);

create table identity_email_verifications (
  account_id uuid primary key references accounts(id) on delete cascade,
  email text not null,
  verified_at timestamptz not null default now()
);

-- Down Migration

drop table identity_email_verifications;
drop table identity_mail_tokens;
