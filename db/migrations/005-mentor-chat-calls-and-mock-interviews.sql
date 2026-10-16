-- Mentor chat, mentor-provided meeting links, and voice mock interviews.

alter table mentor_requests
  add column if not exists call_url text,
  add column if not exists call_scheduled_at timestamptz;

create table if not exists mentor_chat_messages(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references mentor_requests(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  reported_at timestamptz,
  reported_by uuid references users(id) on delete set null,
  report_reason text check(report_reason is null or length(report_reason) between 1 and 500)
);
create index if not exists chat_messages_request on mentor_chat_messages(request_id,created_at);
alter table mentor_chat_messages add column if not exists reported_by uuid references users(id) on delete set null;
create index if not exists chat_messages_reported on mentor_chat_messages(reported_at) where reported_at is not null;

create table if not exists mock_interviews(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  skill_slug text not null,
  status text not null default 'started' check(status in ('started','scoring','completed','abandoned')),
  mode text not null default 'ai' check(mode in ('ai','fallback')),
  model text,
  server_score numeric(5,2) check(server_score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists mock_interviews_user on mock_interviews(user_id,started_at desc);

create table if not exists mock_interview_questions(
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references mock_interviews(id) on delete cascade,
  position int not null check(position between 1 and 10),
  prompt text not null,
  transcript text check(transcript is null or length(transcript) between 1 and 6000),
  score numeric(5,2) check(score between 0 and 100),
  feedback text,
  latency_ms int check(latency_ms is null or latency_ms between 0 and 600000),
  unique(interview_id,position)
);
create index if not exists mock_interview_questions_interview on mock_interview_questions(interview_id,position);
