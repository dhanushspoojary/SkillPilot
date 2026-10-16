-- Production audit fixes: retryable mock interview scoring, durable mentor access, retention, and evidence hardening.

alter table mock_interviews add column if not exists updated_at timestamptz not null default now();
alter table mock_interviews drop constraint if exists mock_interviews_status_check;
alter table mock_interviews add constraint mock_interviews_status_check check(status in ('started','scoring','completed','abandoned'));
create index if not exists mock_interviews_scoring on mock_interviews(status, updated_at);

-- Keep chat/reporting data bounded by the same retention policy used by agent runs.
create index if not exists mentor_chat_messages_created on mentor_chat_messages(created_at);

-- Evidence append-only trigger remains in place; this migration records the intended application role.
create table if not exists security_role_notes(
  key text primary key,
  value text not null
);
create or replace function skillpilot_delete_account(target_user uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('skillpilot.allow_account_delete','on',true);
  delete from users where id=target_user;
end;
$$;

insert into security_role_notes(key,value) values
 ('evidence_policy','Application role must not own authoritative evidence tables; use owner-managed migrations and controlled deletion procedures.'),
 ('mentor_review_policy','Mentor review is advisory evidence and requires an approved mentor account; production deployments should add independent credential verification.')
on conflict(key) do update set value=excluded.value;


-- Defense in depth: the account-deletion SECURITY DEFINER function must never be callable by
-- anonymous/public database roles. The web application gets EXECUTE only through the dedicated
-- least-privilege role created by the migration wrapper.
REVOKE ALL ON FUNCTION skillpilot_delete_account(uuid) FROM PUBLIC;
