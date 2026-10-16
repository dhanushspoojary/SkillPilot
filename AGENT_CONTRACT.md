# SkillPilot Agent Contract

The Career Agent is the product's reasoning layer, but it is deliberately not the trust layer.

## Reads

The agent may read, through server-side tools:
- the authenticated student's evidence summary;
- deterministic skill gaps and readiness;
- deterministic next actions;
- currently approved mentors.

## Proposals

The agent may propose:
- a retest;
- an existing roadmap action;
- a mentor request draft.

Every proposal is `approval_required`.

## Blocks

The agent has no tool to:
- write evidence;
- alter a score;
- verify a skill;
- approve a mentor;
- change a role;
- send a mentor request;
- read another user's data;
- publish a credential silently.

## Source of truth

PostgreSQL evidence and deterministic server-side assessment scoring are authoritative.
LLM output is advisory and auditable.

## Failure behavior

If the provider is unavailable, times out, returns invalid JSON, exceeds limits, or exceeds the tool-step cap, SkillPilot returns the deterministic career plan and explicitly reports fallback mode.

## Production controls

The agent route enforces:
- authenticated student sessions;
- per-account/network rate limits;
- global hourly capacity;
- request-size limits;
- provider response-size limits;
- tool allow-listing;
- strict argument validation;
- prompt/data separation;
- server-only provider credentials;
- PostgreSQL audit records.
