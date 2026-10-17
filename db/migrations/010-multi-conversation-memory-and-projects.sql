-- SkillPilot Migration 010: Multi-Conversation Threads, Student Learning Memories, and Practical Project Workspace

-- 1. Conversation Threads
create table if not exists conversation_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'New Conversation',
  archived boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_threads_user_updated on conversation_threads(user_id, updated_at desc);

-- 2. Link career_conversations to threads
alter table career_conversations add column if not exists thread_id uuid references conversation_threads(id) on delete cascade;
create index if not exists career_conversations_thread_created on career_conversations(thread_id, created_at asc);

-- 3. Student Learning Memories (Durable, inspectable student context)
create table if not exists student_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category text not null check(category in ('preference', 'strength', 'goal', 'struggle', 'background', 'project_interest')),
  fact text not null,
  source text not null default 'conversation',
  confidence numeric not null default 0.85 check(confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_memories_user_cat on student_memories(user_id, category, updated_at desc);

-- 4. Practical Projects Workspace
create table if not exists student_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null,
  required_skills jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check(status in ('not_started', 'in_progress', 'submitted', 'verified', 'needs_revision')),
  submission_code text,
  test_results jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_project_slug unique(user_id, slug)
);

create index if not exists student_projects_user_status on student_projects(user_id, status, updated_at desc);
