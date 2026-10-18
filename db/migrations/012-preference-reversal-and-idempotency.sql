-- SkillPilot Migration 012: Preference Reversals (Undo) and Request Idempotency
-- Enables undoing roadmap preference modifications and prevents duplicate actions on network retries.

-- 1. Relax change_type constraint to allow reversal and refresh audit records
alter table roadmap_preference_changes drop constraint if exists roadmap_preference_changes_change_type_check;
alter table roadmap_preference_changes add constraint roadmap_preference_changes_change_type_check
  check(change_type in ('pace', 'difficulty', 'focus_skill', 'daily_minutes', 'weekly_hours', 'career_goal', 'reversal', 'roadmap_refresh'));

-- 2. Request Idempotency Records
create table if not exists request_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  idempotency_key text not null,
  action_type text not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  constraint uq_user_idempotency_key unique(user_id, idempotency_key)
);

create index if not exists idx_request_idempotency_keys_time on request_idempotency_keys(created_at);
