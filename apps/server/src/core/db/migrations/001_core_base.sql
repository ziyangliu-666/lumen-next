-- Up Migration

-- The base tables every slice builds on. A slice adds its own tables in a
-- later file named NNN_<slice>_<what>.sql and never edits this one: an applied
-- migration is history.
--
-- Money is numeric(12,6) and every total is a SUM in SQL. A JS number carries
-- a value to the browser; it never adds two of them.

create table accounts (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  display_name text not null,
  role         text not null default 'user' check (role in ('user', 'staff')),
  created_at   timestamptz not null default now()
);

create table projects (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  title      text not null,
  mode       text not null default 'explore' check (mode in ('explore', 'seed')),
  created_at timestamptz not null default now()
);

-- account_id and project_id are text with no foreign key, on purpose and for
-- now. Until identity ships, the principal is the development stub, whose account
-- id is whatever the header says; until projects ships, the project id in the
-- route is taken on trust. A foreign key here would refuse every session the
-- team can open today. The identity and projects migrations convert these
-- columns to uuid and add the references when their tables have rows.
create table sessions (
  id         uuid primary key,
  project_id text not null,
  account_id text not null,
  started_at timestamptz not null default now()
);
create index sessions_account_idx on sessions (account_id);

create table tasks (
  id         uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  parent_id  uuid references tasks(id),
  agent      text not null default 'lead',
  title      text not null default '',
  depth      integer not null default 0,
  status     text not null default 'queued'
               check (status in ('queued', 'running', 'waiting', 'ended', 'stopped', 'failed')),
  own_cost   numeric(12,6) not null default 0,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  -- Insertion order. started_at can tie inside one millisecond, and the call
  -- tree must list children in the order they were delegated.
  seq        bigint generated always as identity
);
create index tasks_session_idx on tasks (session_id, seq);
create index tasks_open_idx on tasks (status) where status in ('queued', 'running', 'waiting');

create table steps (
  task_id    uuid not null references tasks(id) on delete cascade,
  index      integer not null,
  kind       text not null default 'reply',
  text       text not null,
  created_at timestamptz not null default now(),
  primary key (task_id, index)
);

create table findings (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  task_id    uuid not null references tasks(id),
  text       text not null,
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id         uuid primary key default gen_random_uuid(),
  account_id text not null,
  task_id    uuid references tasks(id),
  amount     numeric(12,6) not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index ledger_account_idx on ledger_entries (account_id, created_at);

-- Down Migration

drop table ledger_entries;
drop table findings;
drop table steps;
drop table tasks;
drop table sessions;
drop table projects;
drop table accounts;
