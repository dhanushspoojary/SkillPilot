-- Deterministic assessment item order (random UUID ids made ordering unstable).
alter table assessment_items add column if not exists position bigint generated always as identity;

-- Persist "I did this" roadmap actions; one completed row per user and action.
delete from roadmap_actions a using roadmap_actions b
  where a.status='completed' and b.status='completed' and a.user_id=b.user_id and a.source=b.source and a.ctid < b.ctid;
create unique index if not exists roadmap_user_source_done on roadmap_actions(user_id,source) where status='completed';
