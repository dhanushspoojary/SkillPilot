-- SkillPilot Migration 013: Interactive Lessons, Continuous Practice, and Skill Mastery Tracking

-- 1. Track student progress across interactive learning activities / lessons
create table if not exists student_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  lesson_id text not null,
  status text not null default 'in_progress' check(status in ('not_started', 'in_progress', 'completed')),
  exercises_completed int not null default 0,
  exercises_total int not null default 3,
  last_attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint unique_user_lesson unique(user_id, skill_slug, lesson_id)
);
create index if not exists student_lesson_user_skill on student_lesson_progress(user_id, skill_slug);

-- 2. Track individual question and exercise practice attempts
create table if not exists student_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  topic text not null,
  question_id text not null,
  question_prompt text not null,
  chosen_answer text not null,
  is_correct boolean not null,
  hints_used int not null default 0,
  feedback text,
  created_at timestamptz not null default now()
);
create index if not exists student_practice_user_skill on student_practice_attempts(user_id, skill_slug, created_at desc);

-- 3. Mastery-based progression tracking per concept
create table if not exists student_concept_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  concept text not null,
  mastery_score numeric(5,2) not null default 0,
  status text not null default 'practicing' check(status in ('novice', 'practicing', 'proficient', 'mastered')),
  problems_solved int not null default 0,
  problems_attempted int not null default 0,
  last_practiced_at timestamptz not null default now(),
  needs_review boolean not null default false,
  constraint unique_user_concept unique(user_id, skill_slug, concept)
);
create index if not exists student_concept_user_mastery on student_concept_mastery(user_id, skill_slug, status);

-- 4. Store skills to learn vs skills known separately in capability profiles
alter table student_capability_profiles add column if not exists skills_to_learn jsonb not null default '[]'::jsonb;
alter table student_capability_profiles add column if not exists skills_known jsonb not null default '[]'::jsonb;

-- 5. Persistent repository of vetted, templated, and AI-generated practice questions
create table if not exists practice_questions (
  id text primary key,
  skill_slug text not null,
  topic text not null,
  difficulty text not null check(difficulty in ('introductory','foundational','intermediate','advanced')),
  question_type text not null check(question_type in ('conceptual','code_tracing','debugging','fill_in_the_blank','problem_solving')),
  prompt text not null,
  code_snippet text,
  choices jsonb not null default '[]'::jsonb,
  correct_index int not null,
  hints jsonb not null default '[]'::jsonb,
  explanation text not null,
  misconception text,
  source text not null default 'vetted' check(source in ('vetted','template','gemini_ai')),
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists practice_questions_skill_topic on practice_questions(skill_slug, topic, difficulty);
