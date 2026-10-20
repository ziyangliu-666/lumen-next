-- Up Migration

-- The agent registry (docs/platform/public-api.md). An agent is withdrawn,
-- never deleted, so the sessions it ran still count in usage.
create table platform_agents (
  id               uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references accounts(id) on delete cascade,
  slug             text not null unique,
  name             text not null,
  description      text not null,
  instructions     text not null,
  withdrawn_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index platform_agents_owner_idx on platform_agents (owner_account_id);

-- One row per question asked through POST /api/v1/questions. It is written
-- before the session exists, because the root turn can reach a worker before
-- POST /api/projects returns; the worker claims it by session_id, or else by
-- account and question text ("How a chosen agent reaches the worker").
-- account_id has no foreign key: it is the same id the sessions table keeps.
create table platform_question_intents (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  agent_id   uuid references platform_agents(id),
  question   text not null,
  session_id uuid unique,
  created_at timestamptz not null default now()
);
create index platform_question_intents_unclaimed_idx
  on platform_question_intents (account_id, created_at desc) where session_id is null;
create index platform_question_intents_agent_idx on platform_question_intents (agent_id);

-- Down Migration

drop table platform_question_intents;
drop table platform_agents;
