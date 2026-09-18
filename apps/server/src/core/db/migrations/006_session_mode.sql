-- Up Migration

-- A session runs in the mode its project chose. Rows written before this
-- column existed were all opened by the Session page, which only explores.
alter table sessions
  add column mode text not null default 'explore' check (mode in ('explore', 'seed'));

-- Project cards ask "the sessions of this project, newest first" on every poll.
create index sessions_project_idx on sessions (project_id, started_at desc);

-- Down Migration

drop index sessions_project_idx;
alter table sessions drop column mode;
