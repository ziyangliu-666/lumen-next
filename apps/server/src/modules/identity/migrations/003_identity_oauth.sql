-- REVIEW CANDIDATE: core owns numbering and transactional production rollout.
-- Account provider credentials already exist in 002_identity_auth.sql.
create table identity_oauth_attempts (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  binding_hash text not null check (binding_hash ~ '^[a-f0-9]{64}$'),
  provider text not null check (provider in ('github', 'google')),
  verifier text not null,
  expires_at timestamptz not null
);
create index identity_oauth_attempts_expiry_idx on identity_oauth_attempts (expires_at);
