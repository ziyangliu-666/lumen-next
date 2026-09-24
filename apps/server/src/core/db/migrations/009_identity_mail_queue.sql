-- Up Migration

-- Mail requests are admitted with one insert and delivered by the identity
-- mail worker, so a public response never depends on account eligibility.
create table identity_mail_requests (
  id           uuid primary key default gen_random_uuid(),
  purpose      text not null check (purpose in ('verify', 'reset')),
  email        text not null,
  email_key    text not null check (email_key ~ '^[a-f0-9]{64}$'),
  account_id   uuid references accounts(id) on delete cascade,
  state        text not null default 'pending' check (state in ('pending', 'done', 'failed')),
  attempts     integer not null default 0,
  not_before   timestamptz not null default now(),
  requested_at timestamptz not null default now()
);
create index identity_mail_requests_due_idx
  on identity_mail_requests (not_before) where state = 'pending';
create index identity_mail_requests_key_idx
  on identity_mail_requests (email_key, purpose, requested_at);

-- Down Migration

drop table identity_mail_requests;
