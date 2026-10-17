-- Up Migration

-- The model a session was opened with, from the server's allowed list
-- (LUMEN_MODELS). Null is the server's default model, which is every session
-- opened before the choice existed.
alter table sessions add column model text;

-- Down Migration

alter table sessions drop column model;
