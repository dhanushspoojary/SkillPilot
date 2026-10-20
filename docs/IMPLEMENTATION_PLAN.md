# SkillPilot Comprehensive Implementation Plan & Team Architecture

**Project**: SkillPilot  
**Mission**: Build a Complete, Trustworthy Career Intelligence Platform with a World-Class User Experience  
**Core Promise**: *"Know your next step. Build real skills. Prove what you can do."*  
**Branch**: `feat/agentic-skillpilot`  
**Workspace**: `apps/web`  

---

## 1. System Vision & Architecture

SkillPilot is an evidence-first career operating system designed for students. The core workflow is:

```
UNDERSTAND THE STUDENT
        |
        v
ASSESS CURRENT CAPABILITIES
        |
        v
IDENTIFY VERIFIED SKILL GAPS
        |
        v
RECOMMEND ONE CLEAR NEXT STEP
        |
        v
LEARN AND PRACTICE
        |
        v
BUILD PROJECTS AND EVIDENCE
        |
        v
GET AI OR HUMAN MENTORSHIP
        |
        v
PRACTICE INTERVIEWS
        |
        v
UPDATE SKILL PASSPORT
        |
        v
REASSESS AND IMPROVE
```

### Signature Principle: Proof, Not Points
A student never receives a verified skill merely by clicking a button or entering a self-declared claim. Every capability signal is categorized across five strictly enforced tiers:
1. **Self-Declared**: Unverified claims from onboarding. Guides starting diagnostics but carries 0% career readiness weight.
2. **Assessed**: Objective, server-evaluated diagnostic quizzes across Levels 0–5 with question banks and server answer checking.
3. **Demonstrated**: Execution trace tables, completed project milestones, and hands-on Practice Arena code submissions.
4. **Reviewed**: Verified peer or human code review feedback stored as immutable database evidence.
5. **Mentor-Endorsed**: Approved college senior or industry mentor evaluation submitted through an authenticated database transaction.

---

## 2. Four-Member Team Functional Ownership & Presentation Guide

To support genuine collaboration and presentation to hackathon judges or technical evaluators, SkillPilot is structured into four distinct, cohesive architectural domains:

### Member 1: Frontend Design System, Dashboard & Responsive UX
- **Domain**: UI/UX Architecture, Visual Design, Responsive Foundation, Dashboard Streamlining.
- **Key Modules**:
  - `apps/web/app/globals.css`: Design token system (colors, typography, spacing, glassmorphism, mobile bottom bar, focus rings).
  - `apps/web/components/App.tsx`: Unified app shell, desktop left navigation, mobile 5-item bottom bar (`Home`, `Practice`, `Learn`, `Mentors`, `More`), and user profile menu.
  - `apps/web/components/views.tsx`: Streamlined `Today` dashboard focused on **ONE primary recommended action** (`.priority-card`), estimated duration, expandable *"Why this?"* rationale, compact progress strip, and progressive disclosure for secondary queues.
  - `apps/web/components/CapabilityOnboarding.tsx`: Progressive conversational onboarding with 43 categorized skills and adaptive diagnostic launch.

### Member 2: Assessments, Learning Workspace, Practice Arena & Evidence Engine
- **Domain**: Educational Engine, Adaptive Testing, Practice Arena, Code Runner Boundary.
- **Key Modules**:
  - `apps/web/components/LearnWorkspace.tsx`: 3-stage learning journey (Intro, Code Walkthrough with variable trace table, Socratic Practice with misconception diagnosis).
  - `apps/web/components/PracticeArena.tsx` & `apps/web/lib/practice-arena.ts`: Problem-solving arena with 5 original problems across algorithms and SQL, 5-stage Hint Ladder (Nudge, Concept, Pseudocode, Debug, Solution), mobile code accessories (`{}()[];"='`), and safe execution boundary.
  - `apps/web/lib/next-action-engine.ts`: Deterministic, explainable recommendation engine computing the single highest-leverage task based on 7 live user states.
  - `apps/web/lib/practice-engine.ts` & `apps/web/lib/assessment-planner.ts`: Adaptive question selector, prerequisite graph, and immutable evidence recorder.

### Member 3: AI Companion, Mock Interview Experience & Mentorship Workflows
- **Domain**: Conversational AI, Audio-Reactive Visualizations, Speech Interfaces, Mentor Matching.
- **Key Modules**:
  - `apps/web/components/AgentPanel.tsx`: Natural conversational AI companion with Web Speech API voice input (microphone) and text-to-speech (read aloud), multi-threading, persistent memory, and elimination of internal tool/trace leaks.
  - `apps/web/app/api/agent/route.ts`: Idempotent agent endpoint supporting real Google Gemini integration with deterministic fallback.
  - `apps/web/components/MockInterview.tsx`: Dual-mode mock interview system:
    - *Mode A (AI Interviewer)*: 6 tracks (Technical, HR, Behavioral, Coding, Project, Internship), real-time audio-reactive waveform canvas, spoken questions, and STAR-structured evaluation reports.
    - *Mode B (Mentor-Led Mock Interview)*: Structured mentor booking, meeting link generation, and human assessment ledger.
  - `apps/web/components/MentorWorkspace.tsx` & `apps/web/components/MentorsWorkspace.tsx`: Multi-tier mentor discovery (College Senior, Recent Grad, Industry Pro), mutual agreement workflow, private messaging, and verified progress sharing.

### Member 4: Backend, Database, Security, Administration & Deployment
- **Domain**: PostgreSQL Persistence, Authentication, Authorization, Anti-Abuse, Admin Controls, CI/CD.
- **Key Modules**:
  - `apps/web/lib/db.ts` & `db/schema.sql`: Complete PostgreSQL schema with connection pooling, foreign keys, cascade safety, and append-only evidence constraints.
  - `apps/web/lib/server-security.ts`: Secure HttpOnly session cookies, CSRF exact-origin validation, bounded JSON bodies, rate limiting, and cross-student data isolation.
  - `apps/web/components/AdminWorkspace.tsx`: Server-authorized administration: mentor application review queue (Approve/Reject), user suspension/reactivation, and chat moderation queue.
  - `apps/web/app/p/[handle]/page.tsx` & `apps/web/lib/passport.ts`: Public Skill Passport at `/p/[handle]` with 5 verification tiers, section-level privacy, cryptographic evidence fingerprints, and social share cards (LinkedIn, X, WhatsApp).
  - `docs/DEPLOYMENT.md` & `Dockerfile`: Containerized production deployment, environment variable validation, and health checks.

---

## 3. Implementation Checklist & Status

| Phase | Description | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Audit & Baseline Verification** | Repository audit, test suite verification, branch check (`feat/agentic-skillpilot`) | **COMPLETED** |
| **Phase 2** | **Cognitive Load & Dashboard Streamlining** | Streamline `Today` to ONE primary action, estimated time, *"Why this?"* toggle, compact progress summary | **COMPLETED** |
| **Phase 3** | **Natural AI Companion UX** | Remove internal tool names/traces, add voice mic & speech synthesis, ensure idempotency | **COMPLETED** |
| **Phase 4** | **Practice Arena & Safe Runner Boundary** | 5 original problems, 5-stage Hint Ladder, mobile keyboard toolbar, secure execution endpoint | **COMPLETED** |
| **Phase 5** | **Beginner-First Onboarding & Adaptive Testing** | Calibrated background discovery, diagnostic questions without assuming unearned skills | **COMPLETED** |
| **Phase 6** | **One Next Step Engine** | Deterministic engine with 7 distinct student states, explainable reasons, and direct task deep links | **COMPLETED** |
| **Phase 7** | **Trustworthy Mentorship Workflows** | 3 mentor categories, verification states, mutual agreement, private messaging, honest call fallback | **COMPLETED** |
| **Phase 8** | **Comprehensive Mock Interview System** | 6 interview tracks, honest waveform canvas, Web Speech voice, STAR feedback reports, Mode B mentor interviews | **COMPLETED** |
| **Phase 9** | **Evidence-Based Skill Passport (`/p/[handle]`)** | Public route, 5 verification tiers, evidence ledger, cryptographic fingerprint, social sharing | **COMPLETED** |
| **Phase 10** | **Admin Workspace & Content Management** | Server-enforced mentor approval, user management, misconduct queue, platform health | **COMPLETED** |
| **Phase 11** | **Security Hardening & Privacy Audit** | CSRF protection, secure cookies, SQL parameterization, rate limiting, cross-tenant isolation, account export/deletion | **COMPLETED** |
| **Phase 12** | **Mobile Responsiveness & Design System** | Viewport testing (320px–1440px), 44px touch targets, mobile bottom bar, zero horizontal overflow | **COMPLETED** |
| **Phase 13** | **PWA Capabilities & Performance** | Web app manifest, theme color, service worker readiness, asset optimization | **COMPLETED** |
| **Phase 14** | **Testing, Verification & Production Build** | Unit tests (140/140), typecheck (0 errors), E2E browser tests, Next.js production build | **COMPLETED** |

---

## 4. Integration & Fallback Strategy

When external third-party services or API credentials are not available in a local development or testing environment, SkillPilot implements secure, transparent fallbacks rather than fabricating data:

1. **Google Gemini LLM**:
   - If `GEMINI_API_KEY` is present, queries are processed with real Gemini reasoning.
   - If unavailable or rate-limited, the system transparently utilizes the deterministic career intelligence engine (`next-action-engine.ts`) with clear educational guidance and zero fabricated metrics.
2. **Voice Synthesis & Speech Recognition**:
   - Uses native browser Web Speech API (`webkitSpeechRecognition` / `SpeechSynthesisUtterance`).
   - If unsupported by the client browser or microphone permissions are denied, the interface seamlessly falls back to text-based interaction with appropriate feedback.
3. **Code Execution Sandbox**:
   - For JavaScript/Python/SQL evaluation, safe validation is performed with syntax verification, sample test runner boundaries, and input sanitization.
   - Arbitrary shell commands are strictly prohibited on the application server. If an external sandboxed runner is offline, drafting and static validation remain functional while clearly explaining runner status.
4. **Live Video Calls**:
   - Authorized mentors and students can exchange validated meeting links (Google Meet, Zoom, Teams, Jitsi, Whereby).
   - If WebRTC / LiveKit credentials are not configured, the interface displays an honest fallback providing secure room URLs without exposing unauthenticated access.
