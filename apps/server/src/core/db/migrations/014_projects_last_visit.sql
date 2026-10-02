-- Up Migration
alter table projects add column last_opened_at timestamptz;
alter table projects add column spend_at_visit numeric(12,6) not null default 0;

-- Down Migration
alter table projects drop column spend_at_visit;
alter table projects drop column last_opened_at;
