-- Migration 014: Mentor-to-Student Calling & Realtime Signalling

create table if not exists mentor_call_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references mentor_requests(id) on delete cascade,
  mentor_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  room_name text not null,
  status text not null default 'ringing' check(status in ('ringing','accepted','declined','ended','expired')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);

create index if not exists mentor_call_sessions_student on mentor_call_sessions(student_id, status, created_at desc);
create index if not exists mentor_call_sessions_request on mentor_call_sessions(request_id, status, created_at desc);
