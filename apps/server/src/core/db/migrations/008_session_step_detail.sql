-- Up Migration

-- What a step carried beyond its line of text: the tool, the time it took, its
-- cost, its rows or output, the tasks a delegate step opened. One jsonb column,
-- because the shape is the contract's StepDetail, every field of it is
-- optional, and nothing queries inside it: it is written once and read back
-- whole. Null for a step that carried nothing, which every earlier step is.
alter table steps add column detail jsonb;

-- Down Migration

alter table steps drop column detail;
