# SkillPilot

**An evidence-driven career operating system for students.**

SkillPilot turns real progress into a living skill profile:

**Assess → Diagnose → Plan → Act → Prove → Reassess**

This version is a real multi-user architecture rather than a seeded demo.

## Roles

### Student
- Creates a real account.
- Gets an empty evidence profile.
- Takes server-scored adaptive assessments.
- Sees only mentors who actually registered and were approved.
- Sends account-bound mentor requests.
- Receives mentor reviews that become server-owned evidence.
- Chats with an accepted mentor through a request-scoped, rate-limited chat.
- Receives a mentor-provided Google Meet, Zoom, Teams, Jitsi or Whereby session link.
- Runs three-question voice mock interviews with browser transcription and AI/fallback scoring.
- Uses the Career Agent to understand gaps and approve proposed actions.

### Mentor
- Creates a real mentor account.
- Remains invisible while pending.
- Completes a profile.
- Becomes discoverable only after admin approval.
- Sees only student requests assigned to that mentor.
- Writes reviews tied to a real request.
- A completed review atomically creates mentor evidence for the student.
- Manages accepted-request chat, meeting links and student interview context.

### Admin
- Is created only through the server-side bootstrap command.
- Approves/rejects mentors.
- Reviews reported mentor-chat messages in the moderation workspace.
- Controls the trust boundary without a public admin-registration route.

## Trust architecture

The browser is **not authoritative**.

- Assessment questions are selected by the server.
- The answer key never ships to the browser.
- Assessment answers are checked server-side.
- Evidence is written to PostgreSQL server-side.
- Mentor evidence is written only inside an authorized transaction.
- LocalStorage cannot create or modify authoritative evidence.
- The Career Agent reads the authenticated student's database state, not a state object supplied by the browser.

## Agentic AI

The Career Agent is a bounded tool-using agent running server-side.

It can:
- read the student's evidence;
- inspect deterministic next actions;
- inspect approved mentors;
- propose a retest;
- propose an action;
- propose a mentor request.

It cannot:
- create evidence;
- change a score;
- verify a skill;
- approve a mentor;
- send a mentor request by itself;
- access another user's data.

Every run is audited in PostgreSQL. If the LLM is unavailable, SkillPilot falls back to the deterministic career engine instead of pretending the AI worked.

## Security / anti-abuse

The platform includes:

- HttpOnly secure session cookies;
- random server-side sessions stored as token hashes;
- bcrypt password hashing;
- role-based authorization;
- exact-origin protection for browser mutations;
- bounded request bodies;
- account/network rate limits;
- agent cost limits;
- no-store private responses;
- no-index/no-snippet API responses;
- same-origin resource policy;
- approved-only mentor discovery;
- account ownership checks;
- server-authoritative scoring;
- no client answer key;
- immutable-by-application-policy evidence;
- PostgreSQL constraints and transactional mentor evidence.

Scraping cannot be made mathematically impossible. For a public launch, place the app behind a WAF/CDN with distributed rate limiting and bot management.

## Stack

- Next.js 15.5.27 + React 19.2.3
- PostgreSQL 16
- Node.js server routes
- bcryptjs + random server sessions
- Anthropic Messages API (optional)
- Docker Compose
- Lucide icons

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Set `DATABASE_URL` and run `db/schema.sql` against PostgreSQL first.

## Full Docker deployment

```bash
cp .env.example .env
# edit .env and set a strong POSTGRES_PASSWORD

docker compose -f docker-compose.full.yml up -d --build
```

Bootstrap the first admin from the running web container:

```bash
docker compose -f docker-compose.full.yml exec \
  -e SKILLPILOT_ADMIN_EMAIL=admin@example.com \
  -e SKILLPILOT_ADMIN_PASSWORD='use-a-unique-16+-character-password' \
  -e SKILLPILOT_ADMIN_NAME='SkillPilot Admin' \
  web node scripts/bootstrap-admin.mjs
```

Then open the configured web origin.

## Verification performed for this package

- **29/29 dependency-free web/engine/agent tests pass in this release.**
- Database and API integration test scripts are included and wired into CI.
- CI and Docker use `npm install` in this archive because the build environment could not resolve the npm registry; a complete lockfile should be generated before claiming fully reproducible builds.
- Production Compose keeps Next.js private behind Caddy TLS.
- Static TypeScript parsing was checked; full typecheck requires the declared npm dependencies to be installed.
- The packaging environment could not reach the npm registry, so dependency installation, typecheck and Next production build could not be executed here. Static TypeScript syntax checks and the dependency-free tests are included; run the full CI pipeline from a registry-connected environment before production launch.

See:

- `SECURITY.md` — threat model and hardening
- `DEPLOYMENT.md` — production setup
- `AGENT_CONTRACT.md` — agent permissions and safety boundary

## Final architecture

SkillPilot is a server-authoritative multi-user platform. Students, mentors and administrators have separate roles. Mentors are never seeded into production: they register, complete a profile, and become discoverable only after administrator approval. Assessments are scored on the server, and mentor reviews become append-only evidence through an authenticated database transaction.

The Career Agent is an agentic orchestration layer over that evidence. It can read server-derived state, reason with an LLM when configured, use a small allow-listed tool set, and propose next actions. It cannot manufacture evidence or silently perform privileged actions.


### Dependency lockfile

See `LOCKFILE_REQUIRED.md`. From a registry-connected machine, generate and commit `apps/web/package-lock.json`, then switch Docker/CI from `npm install` back to `npm ci` for reproducible builds.
