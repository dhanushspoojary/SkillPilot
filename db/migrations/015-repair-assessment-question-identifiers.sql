-- Migration 015: Repair assessment question identifiers and canonicalize prompt JSON
-- Resolves "Diagnostic Question Notice — The diagnostic question format could not be verified securely (Question is missing a valid identifier: id or question_id)"

-- 1. Backfill 'id' from question_id for all prompt objects missing an id
update assessment_items
set prompt = jsonb_set(prompt, '{id}', to_jsonb(question_id))
where prompt->>'id' is null or prompt->>'id' = '';

-- 2. Backfill 'q' from 'text' if prompt text was stored under legacy key
update assessment_items
set prompt = jsonb_set(prompt, '{q}', prompt->'text')
where (prompt->>'q' is null or prompt->>'q' = '') and prompt->>'text' is not null and prompt->>'text' != '';

-- 3. Backfill 'skill' from skill_slug if missing
update assessment_items
set prompt = jsonb_set(prompt, '{skill}', to_jsonb(skill_slug))
where prompt->>'skill' is null or prompt->>'skill' = '';

-- 4. Backfill 'level' from 'difficulty' if missing
update assessment_items
set prompt = jsonb_set(prompt, '{level}', prompt->'difficulty')
where (prompt->>'level' is null or prompt->>'level' = '') and prompt->>'difficulty' is not null;
