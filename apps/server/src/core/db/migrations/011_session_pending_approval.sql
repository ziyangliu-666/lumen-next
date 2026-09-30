-- Up Migration

-- The operation a waiting task is waiting for (PendingApproval in
-- core/domain/task.ts): attempt id, approval id, check point, the input, and
-- the fan-out when that is what was refused. Written when the guard escalates,
-- cleared when the task resumes, so a restart keeps every approval in flight.
alter table tasks add column pending jsonb;
create index tasks_pending_approval_idx on tasks ((pending->>'approvalId')) where pending is not null;

-- Down Migration

drop index tasks_pending_approval_idx;
alter table tasks drop column pending;
