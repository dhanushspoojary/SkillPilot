-- SkillPilot Migration 011: Roadmap Preferences, Adaptive Difficulty, and Change History
-- Stores natural-language preference modifications with audited change history,
-- preserving completed roadmap actions and progress.

-- 1. Extend student_capability_profiles with adaptive preferences
alter table student_capability_profiles
  add column if not exists preferred_pace text not null default 'moderate',
  add column if not exists difficulty_preference text not null default 'standard',
  add column if not exists primary_focus_skill text default 'problem-solving',
  add column if not exists daily_minutes int not null default 30;

-- 2. Roadmap Preference Change History
create table if not exists roadmap_preference_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  request_text text not null,
  change_type text not null check(change_type in ('pace', 'difficulty', 'focus_skill', 'daily_minutes', 'weekly_hours', 'career_goal')),
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  reasoning text not null,
  created_at timestamptz not null default now()
);

create index if not exists roadmap_pref_changes_user_time on roadmap_preference_changes(user_id, created_at desc);
