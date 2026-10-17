-- SkillPilot Migration 009: Central Workflow State Machine and Career Conversations

create table if not exists student_workflow_states (
  user_id uuid primary key references users(id) on delete cascade,
  stage text not null default 'REGISTERED' check(stage in (
    'REGISTERED',
    'ONBOARDING_IN_PROGRESS',
    'ONBOARDING_COMPLETE',
    'ASSESSMENT_IN_PROGRESS',
    'ASSESSMENT_COMPLETE',
    'SKILL_BASELINE_REVIEW',
    'SKILLS_CONFIRMED',
    'LEARNING_GOALS_CONFIRMED',
    'ROADMAP_READY',
    'LEARNING_IN_PROGRESS',
    'REASSESSMENT_DUE',
    'REASSESSMENT_COMPLETE'
  )),
  onboarding_dialogue jsonb not null default '[]'::jsonb,
  confirmed_skills jsonb not null default '{}'::jsonb,
  confirmed_goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_workflow_states_user_stage on student_workflow_states(user_id, stage);

create table if not exists career_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check(role in ('student', 'agent', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists career_conversations_user_created on career_conversations(user_id, created_at asc);
