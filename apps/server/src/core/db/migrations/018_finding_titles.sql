-- Up Migration

-- A short name for each finding, written by the agent that kept it. Null
-- on findings kept before names; the lists then show the text alone.
alter table findings add column title text;

-- Down Migration

alter table findings drop column title;
