-- One relational database for the whole monolith. Sprint 1 schema.
-- Slice owners add their own tables here via a numbered migration.

create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  display_name text not null,
  role         text not null default 'user' check (role in ('user', 'staff')),
  created_at   timestamptz not null default now()
);

create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  title      text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  parent_id  uuid references tasks(id),
  agent      text not null default 'lead',
  title      text not null default '',
  depth      integer not null default 0,
  status     text not null default 'queued'
               check (status in ('queued', 'running', 'waiting', 'ended', 'stopped', 'failed')),
  own_cost   numeric(12,6) not null default 0,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

create table if not exists ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id),
  task_id    uuid references tasks(id),
  amount      numeric(12,6) not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);
