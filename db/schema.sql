-- SkillPilot production schema. No seeded students or mentors.
create extension if not exists pgcrypto;

create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check(role in ('student','mentor','admin')),
  name text not null,
  status text not null default 'active' check(status in ('active','suspended')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_role_status on users(role,status);

create table if not exists sessions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_user_expiry on sessions(user_id,expires_at);

create table if not exists career_goals(id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, role_name text not null, target_level text, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists skills(id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, category text not null);
create table if not exists skill_dependencies(skill_id uuid not null references skills(id) on delete cascade, prerequisite_skill_id uuid not null references skills(id) on delete cascade, primary key(skill_id,prerequisite_skill_id));

create table if not exists user_skill_evidence(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
  skill_id uuid not null references skills(id), source text not null check(source in ('assessment','project','mentor','practice')),
  score numeric(5,2) not null check(score between 0 and 100), confidence numeric(4,3) not null check(confidence between 0 and 1),
  captured_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb,
  immutable boolean not null default true
);
create index if not exists evidence_user_skill on user_skill_evidence(user_id,skill_id,captured_at desc);

create table if not exists assessments(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
  kind text not null, version text not null, status text not null check(status in ('started','completed','abandoned')),
  started_at timestamptz not null default now(), completed_at timestamptz, server_score numeric(5,2)
);
create table if not exists assessment_items(
  id uuid primary key default gen_random_uuid(), assessment_id uuid not null references assessments(id) on delete cascade,
  question_id text not null, skill_slug text not null, prompt jsonb not null, response jsonb, score numeric(5,2) check(score between 0 and 100), latency_ms int,
  position bigint generated always as identity
);
create unique index if not exists assessment_question_once on assessment_items(assessment_id,question_id);

create table if not exists mentor_profiles(
  user_id uuid primary key references users(id) on delete cascade,
  bio text not null default '', focus text not null default '', skills jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
  approved_by uuid references users(id), approved_at timestamptz, rejection_reason text
);
create index if not exists mentor_profiles_status on mentor_profiles(status);

create table if not exists mentor_requests(
  id uuid primary key default gen_random_uuid(), student_id uuid not null references users(id) on delete cascade,
  mentor_id uuid not null references users(id) on delete cascade,
  message text not null check(length(message) between 1 and 1200),
  status text not null default 'pending' check(status in ('pending','accepted','declined','completed','cancelled')),
  created_at timestamptz not null default now(), responded_at timestamptz
);
create index if not exists mentor_requests_student on mentor_requests(student_id,created_at desc);
create index if not exists mentor_requests_mentor on mentor_requests(mentor_id,status,created_at desc);

create table if not exists mentor_reviews(
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references mentor_requests(id) on delete cascade,
  mentor_id uuid not null references users(id) on delete cascade, student_id uuid not null references users(id) on delete cascade,
  skill_slug text not null, score numeric(5,2) not null check(score between 0 and 100), confidence numeric(4,3) not null check(confidence between 0 and 1),
  review text not null check(length(review) between 10 and 2000), created_at timestamptz not null default now()
);
create index if not exists mentor_reviews_student on mentor_reviews(student_id,created_at desc);

create table if not exists roadmap_actions(id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, title text not null, week_start date not null, priority int not null, status text not null default 'ready' check(status in ('ready','active','completed','skipped')), source text not null, reason text, completed_at timestamptz);
create index if not exists roadmap_user_week on roadmap_actions(user_id,week_start,priority);

create table if not exists agent_runs(id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, agent text not null, input_hash text not null, provider text, model_version text, status text not null check(status in ('proposed','approved','executed','failed','rolled_back')), output jsonb not null, created_at timestamptz not null default now());
create table if not exists agent_actions(id uuid primary key default gen_random_uuid(), agent_run_id uuid not null references agent_runs(id) on delete cascade, action_type text not null, permission text not null check(permission in ('automatic','approval_required','blocked')), proposed_payload jsonb not null, executed_at timestamptz);
create index if not exists agent_runs_user_time on agent_runs(user_id,created_at desc);

create table if not exists security_events(id uuid primary key default gen_random_uuid(), user_id uuid references users(id) on delete set null, event_type text not null, ip_hash text, user_agent_hash text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists security_events_time on security_events(created_at desc);

-- Evidence is immutable by policy. Updates/deletes must go through a controlled service path; application code never exposes such an endpoint.

insert into skills(slug,name,category) values
('javascript','JavaScript','language'),('problem-solving','Problem solving','dsa'),('sql','SQL','data'),('rest-apis','REST APIs','backend'),('communication','Communication','professional'),('git','Git & GitHub','tools')
on conflict(slug) do update set name=excluded.name,category=excluded.category;

create or replace function skillpilot_block_evidence_mutation() returns trigger language plpgsql as $$
begin
  if current_setting('skillpilot.allow_account_delete', true) = 'on' then return old; end if;
  raise exception 'authoritative evidence is append-only';
end; $$;
drop trigger if exists evidence_no_update on user_skill_evidence;
create trigger evidence_no_update before update or delete on user_skill_evidence for each row execute function skillpilot_block_evidence_mutation();
drop trigger if exists mentor_review_no_update on mentor_reviews;
create trigger mentor_review_no_update before update or delete on mentor_reviews for each row execute function skillpilot_block_evidence_mutation();


-- Distributed rate limiting survives restarts and works across multiple web instances.
create table if not exists rate_limits(
  key text primary key,
  window_start timestamptz not null,
  count int not null check(count >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists rate_limits_updated on rate_limits(updated_at);

create unique index if not exists mentor_requests_one_open_pair
  on mentor_requests(student_id,mentor_id)
  where status in ('pending','accepted');

-- One completed marker per user and roadmap action (see /api/activity).
create unique index if not exists roadmap_user_source_done on roadmap_actions(user_id,source) where status='completed';

-- Single-use email verification and password-reset tokens (only the SHA-256 hash is stored).
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

-- Mentor chat, meeting links and voice mock interviews (migration 005).
alter table mentor_requests add column if not exists call_url text, add column if not exists call_scheduled_at timestamptz;
create table if not exists mentor_chat_messages(
  id uuid primary key default gen_random_uuid(), request_id uuid not null references mentor_requests(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade, body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default now(), reported_at timestamptz,
  reported_by uuid references users(id) on delete set null,
  report_reason text check(report_reason is null or length(report_reason) between 1 and 500)
);
create index if not exists chat_messages_request on mentor_chat_messages(request_id,created_at);
create index if not exists chat_messages_reported on mentor_chat_messages(reported_at) where reported_at is not null;
create table if not exists mock_interviews(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null, status text not null default 'started' check(status in ('started','scoring','completed','abandoned')),
  mode text not null default 'ai' check(mode in ('ai','fallback')), model text,
  server_score numeric(5,2) check(server_score between 0 and 100), started_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists mock_interviews_user on mock_interviews(user_id,started_at desc);
create table if not exists mock_interview_questions(
  id uuid primary key default gen_random_uuid(), interview_id uuid not null references mock_interviews(id) on delete cascade,
  position int not null check(position between 1 and 10), prompt text not null,
  transcript text check(transcript is null or length(transcript) between 1 and 6000),
  score numeric(5,2) check(score between 0 and 100), feedback text, latency_ms int check(latency_ms is null or latency_ms between 0 and 600000),
  unique(interview_id,position)
);
create index if not exists mock_interview_questions_interview on mock_interview_questions(interview_id,position);
