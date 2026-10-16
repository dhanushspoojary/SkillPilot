-- Email verification, password reset tokens and retention indexes.
alter table users add column if not exists email_verified_at timestamptz;
-- Accounts that existed before verification was introduced are grandfathered in.
update users set email_verified_at = coalesce(email_verified_at, created_at) where email_verified_at is null;

create table if not exists email_tokens(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check(purpose in ('verify','reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_user on email_tokens(user_id,purpose);
create index if not exists email_tokens_expiry on email_tokens(expires_at);
create index if not exists agent_runs_created on agent_runs(created_at);
