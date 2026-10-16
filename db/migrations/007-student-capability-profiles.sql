-- SkillPilot Migration 007: Student Capability Profiles
-- Stores self-reported beginner background, education, and availability to calibrate starting diagnostics and roadmaps.

create table if not exists student_capability_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  education_level text not null default 'first_year',
  programming_experience text not null default 'beginner',
  field_of_study text not null default 'computer_science',
  career_interests jsonb not null default '["Software Engineer"]'::jsonb,
  weekly_hours int not null default 5,
  focus_areas jsonb not null default '[]'::jsonb,
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists student_capability_profiles_user on student_capability_profiles(user_id);
