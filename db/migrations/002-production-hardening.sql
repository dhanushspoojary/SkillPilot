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

-- Existing installations need the same controlled-delete behaviour as fresh databases.
create or replace function skillpilot_block_evidence_mutation() returns trigger language plpgsql as $$
begin
  if current_setting('skillpilot.allow_account_delete', true) = 'on' then return old; end if;
  raise exception 'authoritative evidence is append-only';
end; $$;

-- Permit account deletion to cascade through historical mentor evidence only inside the
-- account-deletion transaction; normal UPDATE/DELETE remains blocked.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='mentor_reviews'::regclass AND contype='f' AND conname IN ('mentor_reviews_mentor_id_fkey','mentor_reviews_student_id_fkey') LOOP
    EXECUTE format('alter table mentor_reviews drop constraint %I', r.conname);
  END LOOP;
END $$;
alter table mentor_reviews add constraint mentor_reviews_mentor_id_fkey foreign key (mentor_id) references users(id) on delete cascade;
alter table mentor_reviews add constraint mentor_reviews_student_id_fkey foreign key (student_id) references users(id) on delete cascade;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mentor_reviews_request_id_fkey') THEN
    ALTER TABLE mentor_reviews DROP CONSTRAINT mentor_reviews_request_id_fkey;
  END IF;
END $$;
alter table mentor_reviews add constraint mentor_reviews_request_id_fkey foreign key (request_id) references mentor_requests(id) on delete cascade;
