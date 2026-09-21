-- Up Migration

-- Match the temporary principal's arbitrary account ID without writing identity's
-- accounts table. Identity can restore its FK when real principals are deployed.
alter table projects drop constraint projects_account_id_fkey;
alter table projects alter column account_id type text using account_id::text;
create index projects_owner_page_idx on projects (account_id, created_at desc, id desc);

-- Store the validated association in projects' own table; no cross-slice joins.
-- Legacy findings remain session-readable until their owner supplies a backfill.
alter table findings add column project_id uuid references projects(id);
create index findings_project_page_idx on findings (project_id, created_at desc, id desc);
create index findings_session_page_idx on findings (session_id, created_at, id);

-- Down Migration

-- This fails rather than deleting records when temporary non-UUID accounts exist.
drop index findings_session_page_idx;
drop index findings_project_page_idx;
alter table findings drop column project_id;
drop index projects_owner_page_idx;
alter table projects alter column account_id type uuid using account_id::uuid;
alter table projects add constraint projects_account_id_fkey foreign key (account_id) references accounts(id);
