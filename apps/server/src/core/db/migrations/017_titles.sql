-- Up Migration

-- A short name for a session, written by the model after the first question
-- (ChatGPT-style). Null shows the question itself, as every session before
-- titles did. The root task keeps the question: it is the conversation's
-- first message, and the model is given it.
alter table sessions add column title text;

-- Where the project's name came from: 'question' (cut from the first
-- question), 'model' (the first session's title) or 'person' (renamed). A
-- name is written by the model only over a 'question' one, so a later
-- session never renames the project, and a name the person chose stays.
alter table projects add column title_source text not null default 'question'
  check (title_source in ('question', 'model', 'person'));

-- Down Migration

alter table projects drop column title_source;
alter table sessions drop column title;
