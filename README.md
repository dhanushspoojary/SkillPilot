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

- **157/157 unit tests pass** across roadmap engine, auth, server security, career agent, mailer, config, practice arena, diagnostic parser, isolated code execution provider, and LiveKit token issuance (`npm test`).
- **Strict TypeScript typecheck passes with 0 errors** (`npm run typecheck`).
- **Next.js production build compiles cleanly** with 49 dynamic and static routes (`npm run build`).
- **Isolated Execution & LiveKit Security Suite (8/8) passes** testing sandbox length caps, language allowlist, CSRF, auth rejection, deterministic room isolation, and LiveKit JWT token crypto (`node apps/web/scripts/test-execution-and-livekit-security.mjs`).
- **Final Product Suite (13/13) passes** testing Practice Arena, `/p/[handle]`, and database integrity (`node apps/web/scripts/test-final-product-suite.mjs`).
- **Next Action Audit (7/7) passes** testing complete deterministic recommendation engine state coverage (`node apps/web/scripts/test-next-action-audit.mjs`).
- **Security Penetration Audit (17/17) passes** testing origin validation, answer key secrecy, and cross-student isolation (`node apps/web/scripts/test-security-audit.mjs`).
- **End-to-end browser verification passes** (`node apps/web/scripts/test-redesigned-workspace-e2e.mjs`) executing real student registration, full 14-step learning journey, mock interview navigation, and responsive viewport checks from 320px to 1440px with zero horizontal overflow.

## Four-Member Team Collaboration & Presentation Architecture

SkillPilot is structured into four cohesive engineering domains suitable for team presentation:

1. **Member 1 (Frontend Design System, Dashboard & Responsive UX)**:
   - Design token architecture (`globals.css`), app shell navigation, and mobile bottom bar (`App.tsx`).
   - Streamlined `Today` dashboard with ONE primary next action, estimated time, and *"Why this?"* toggle.
   - Conversational student onboarding (`CapabilityOnboarding.tsx`).

2. **Member 2 (Assessments, Learning Workspace, Practice Arena & Evidence)**:
   - 3-stage learning flow (`LearnWorkspace.tsx`) with variable trace table and Socratic feedback.
   - Practice Arena (`PracticeArena.tsx`, `lib/practice-arena.ts`) with 5 original problems and 5-stage Hint Ladder.
   - Deterministic next-action recommendation engine (`lib/next-action-engine.ts`).

3. **Member 3 (AI Companion, Mock Interview Experience & Mentorship)**:
   - Natural conversational AI companion (`AgentPanel.tsx`, `api/agent/route.ts`) with speech input and voice synthesis.
   - Dual-mode mock interview system (`MockInterview.tsx`) with 6 tracks, real-time waveform canvas, and STAR reports.
   - Multi-tier mentor matching, mutual agreement, and secure communications (`MentorsWorkspace.tsx`).

4. **Member 4 (Backend, Database, Security, Administration & Deployment)**:
   - PostgreSQL schema, connection pooling, and append-only evidence constraints (`lib/db.ts`, `schema.sql`).
   - Security controls: bcrypt hashing, HttpOnly sessions, CSRF validation, rate limiting, and RBAC (`server-security.ts`).
   - Public Skill Passport at `/p/[handle]` with 5 verification tiers and cryptographic fingerprints (`app/p/[handle]`, `lib/passport.ts`).
   - Admin workspace (`AdminWorkspace.tsx`), deployment readiness (`docs/DEPLOYMENT.md`), and Docker configuration.

## Documentation Index

- `docs/AUDIT.md` — Complete 14-phase repository audit and baseline findings
- `docs/IMPLEMENTATION_PLAN.md` — System vision, 4-member team architecture, and implementation checklist
- `docs/ACCEPTANCE_MATRIX.md` — Requirement traceability and actual test evidence (23/23 PASS)
- `docs/DEPLOYMENT.md` — Production hosting, environment variable names, and Docker guide
- `docs/SECURITY.md` — Security audit, threat model, RBAC, and penetration defenses

### Dependency lockfile

See `LOCKFILE_REQUIRED.md`. From a registry-connected machine, generate and commit `apps/web/package-lock.json`, then switch Docker/CI from `npm install` back to `npm ci` for reproducible builds.
