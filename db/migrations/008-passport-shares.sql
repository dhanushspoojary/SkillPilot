-- Migration 008: Public Passport Shares with Opaque Tokens and Revocation

create table if not exists passport_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  share_token text not null unique,
  custom_headline text,
  include_name boolean not null default true,
  include_skills boolean not null default true,
  include_evidence boolean not null default true,
  status text not null default 'active' check(status in ('active', 'revoked')),
  views_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists passport_shares_token on passport_shares(share_token);
create index if not exists passport_shares_user on passport_shares(user_id, status);
