-- Up Migration
create table billing_approvals (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  task_id uuid not null,
  attempt_id uuid not null,
  checkpoint text not null check (checkpoint in ('turn', 'fan-out', 'task-open')),
  amount numeric(12,6) not null check (amount >= 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  resume_pending boolean not null default false,
  resume_after timestamptz not null default now(),
  unique (account_id, attempt_id)
);
create index billing_approval_delivery on billing_approvals (resume_after) where resume_pending;

-- Down Migration
drop table billing_approvals;
