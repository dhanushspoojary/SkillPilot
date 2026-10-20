# SkillPilot Deployment & Infrastructure Guide

**Project**: SkillPilot  
**Workspace**: `apps/web`  
**Platform**: Next.js 15 (Node.js >= 20.0.0)  
**Database**: Neon Serverless PostgreSQL  
**Target Audience**: Students on mobile phones, tablets, Chromebooks, and laptops (Zero installation, Zero Docker on student devices).  

---

## 1. Architecture Overview (Zero Student Footprint)

SkillPilot is designed as a cloud-native, responsive web application. **Students and mentors require no local developer tools, no compilers, and no Docker.** They simply navigate to the deployed HTTPS URL from any modern browser (Chrome, Safari, Firefox, Edge on iOS, Android, macOS, Windows, Linux, ChromeOS).

```
+-----------------------------------------------------------------------------------+
|                           STUDENT & MENTOR DEVICES                                |
|           (Mobile Phones, Tablets, Chromebooks, Windows, Mac, Linux)             |
|                       ZERO SOFTWARE / DOCKER REQUIRED                             |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / WSS
                                           v
+-----------------------------------------------------------------------------------+
|                        SKILLPILOT WEB APPLICATION (Next.js)                       |
|           Hosted on Vercel Hobby Free Tier / Cloudflare / Node Cloud Host         |
|  - Server-Side Rendering (SSR) & Next.js API Routes                               |
|  - Strict Origin & CSRF Checks (requireOrigin)                                    |
|  - In-Memory Practice Database Sandbox (node:sqlite :memory: for SQL)             |
|  - Multi-Provider Code Execution Router & Solution Drafting Fallback              |
+-------------+---------------------+-------------------+-------------------+-------+
              |                     |                   |                   |
              v                     v                   v                   v
+-----------------------+ +------------------+ +------------------+ +---------------+
| Neon PostgreSQL (Free)| | Google Gemini AI | | LiveKit Cloud    | | Hosted Runner |
| Persistent Student &  | | Companion Agent  | | WebRTC Mentor    | | OnlineCompiler |
| Evidence Data         | | Free AI Studio   | | Video Calling    | | / Judge0 Rapid |
+-----------------------+ +------------------+ +------------------+ +---------------+
```

---

## 2. Genuinely Free Hosting Infrastructure Stack ($0 / Month)

SkillPilot can be deployed and maintained completely free of charge without requiring credit cards or paid subscriptions:

| Component | Recommended Free Provider | Free Tier Allowance & Terms | Official Source |
| :--- | :--- | :--- | :--- |
| **Web Frontend & API** | **Vercel** (Hobby) | Free forever for personal & educational projects. Unlimited deployments, automatic HTTPS, global edge network. | [vercel.com/pricing](https://vercel.com/pricing) |
| **Production Database** | **Neon** Serverless PostgreSQL | Free Tier: 0.5 GiB storage, 1 compute branch, up to 100 CU-hours/month, automated branching. | [neon.tech/pricing](https://neon.tech/pricing) |
| **AI Companion & Agents** | **Google Gemini** (AI Studio) | Free Tier: 15 RPM, 1 million TPM, 1,500 requests/day on `gemini-2.5-flash` / `gemini-3.5-flash-lite`. No credit card required. | [ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **Mentor-Student Video** | **LiveKit Cloud** | Free Tier: 50 GB monthly bandwidth, unlimited rooms, up to 100 concurrent participants. | [livekit.io/pricing](https://livekit.io/pricing) |
| **SQL Practice Sandbox** | **Built-in `node:sqlite`** | **100% Free & Unlimited**: Runs in-process in `:memory:`. Completely isolated from production PostgreSQL. 0 quota, 0 external API calls. | [nodejs.org/api/sqlite.html](https://nodejs.org/api/sqlite.html) |
| **Multi-Language Runner** | **OnlineCompiler.io API** (Piston-compatible) | Free Tier: 10,000 executions/month (resets 1st of month UTC), 30 runs/min, 512 MB RAM, 30s timeout. No credit card. | [onlinecompiler.io/docs/piston](https://onlinecompiler.io/docs/piston) |
| **Transactional Email** | **Resend** | Free Tier: 100 emails/day (3,000 emails/month). | [resend.com/pricing](https://resend.com/pricing) |

---

## 3. Environment Variables Specification

> [!CAUTION]
> **Production vs. Local Development Separation**:
> - Never set `SKILLPILOT_ALLOWED_ORIGIN` to `http://localhost:3000` in production.
> - Never configure runner or LiveKit URLs pointing to `localhost` on a deployed cloud website.
> - All server-side secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `LIVEKIT_API_SECRET`, `ONLINECOMPILER_API_KEY`) must never use the `NEXT_PUBLIC_` prefix.

### Production Environment Variables:

| Variable Name | Required? | Production Setting |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://<user>:<pass>@<ep-xyz>.neon.tech/skillpilot?sslmode=require` |
| `DATABASE_SSL` | **Yes** | `true` |
| `SKILLPILOT_ALLOWED_ORIGIN` | **Yes** | `https://your-skillpilot-domain.vercel.app` (must match exact canonical domain) |
| `SKILLPILOT_TRUST_PROXY` | **Yes** | `true` (enables correct client IP resolution behind Vercel/Cloudflare edge) |
| `SKILLPILOT_SECURE_COOKIES`| **Yes** | `true` (enforces `Secure; HttpOnly; SameSite=Lax` cookies) |
| `SKILLPILOT_HASH_SECRET` | **Yes** | 32-byte hex string (generate via `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key (`AIza...`) |
| `GEMINI_MODEL_FAST` | Optional | `gemini-3.5-flash-lite` |
| `GEMINI_MODEL_STRONG` | Optional | `gemini-3.5-flash` |
| `LIVEKIT_URL` | **Yes** | `wss://<your-project>.livekit.cloud` |
| `LIVEKIT_API_KEY` | **Yes** | LiveKit API Key (`APILiveKit...`) |
| `LIVEKIT_API_SECRET` | **Yes** | LiveKit API Secret (HMAC-SHA256 signing secret) |
| `RESEND_API_KEY` | Optional | Resend API key (`re_...`) |
| `MAIL_FROM` | Optional | `SkillPilot <no-reply@your-domain.com>` |
| `ONLINECOMPILER_API_KEY` | Optional | OnlineCompiler.io API key (server-side only) |
| `JUDGE0_API_URL` | Optional | `https://judge0-ce.p.rapidapi.com` (if using Judge0) |
| `JUDGE0_API_KEY` | Optional | RapidAPI key (if using Judge0) |
| `JUDGE0_API_HOST` | Optional | `judge0-ce.p.rapidapi.com` |

---

## 4. Code Execution Adapter Architecture & Fallback Behavior

SkillPilot's code execution architecture supports multiple languages and execution models with strict isolation:

```
                          executePracticeSubmission()
                                      |
                     Is language === 'sql'?
                     /                      \
                   YES                       NO
                   /                           \
       +-----------------------+     +-------------------------------+
       | SqliteExecutionProvider|     | Look for configured provider: |
       |  (Isolated in-memory  |     | 1. OnlineCompiler             |
       |  :memory: database)   |     |    (ONLINECOMPILER_API_KEY)   |
       |  0 external credits   |     | 2. Judge0 (JUDGE0_API_URL)    |
       +-----------------------+     | 3. Piston (PISTON_API_URL)    |
                                     +---------------+---------------+
                   |                                 |
                   v                                 v
         Server-Verified Test             Runner Available & Healthy?
               Results?                          /            \
              /        \                       YES             NO
            PASS       FAIL                    /                 \
            /            \           Run Test Cases         Solution Drafting Mode
     Record Skill      Display Fail       on Runner          (runnerType: disabled)
       Evidence           Output         /         \         - 0 fake passes
                                      PASS         FAIL      - Honest outage banner
                                      /               \      - Hints & drafting
                                  Record Evidence   Display    remain fully usable
                                                     Error
```

### Supported Languages & Verified Implementation:
1. **SQL**: Verified via `SqliteExecutionProvider`. Runs inside a clean `:memory:` database with fresh schema per test case. Disallowed from querying the main PostgreSQL database.
2. **Python**: Verified via test harness wrapping entrypoint and stdin parsing.
3. **JavaScript (Node.js)**: Verified via test harness wrapping standard input parsing.
4. **C**: Verified via test harness driver (`maxSubArray` wrapper).
5. **C++**: Verified via test harness driver (`wrapCpp`).
6. **Java**: Verified via test harness driver (`wrapJava` / `Main` class).

### Graceful Fallback (Solution Drafting Mode):
When no external runner is configured, or when the provider hits its rate limit / quota (e.g., OnlineCompiler HTTP 429 or monthly quota ceiling):
- SkillPilot transparently enters **Solution Drafting Mode**.
- `isRunnerAvailable` is set to `false`.
- `success` is set to `false`.
- `totalPassed` is set to `0`.
- **Academic Integrity Guard**: The server refuses to create skill evidence or update student mastery without real server-side execution passes.
- An informative message informs the student:
  `"OnlineCompiler.io rate limit or quota exceeded. SkillPilot is in Solution Drafting Mode until quota resets."`

---

## 5. Step-by-Step Deployment Instructions

### Step 1: Provision Neon PostgreSQL Database
1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Copy the Connection String URI (`postgresql://...sslmode=require`).
3. Open the Neon SQL Editor and execute the schema from `db/schema.sql`.

### Step 2: Obtain Free API Credentials
1. **Google Gemini**: Visit [aistudio.google.com](https://aistudio.google.com) and create an API key (`GEMINI_API_KEY`).
2. **LiveKit Cloud**: Visit [cloud.livekit.io](https://cloud.livekit.io), create a free project, and generate API Keys (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).
3. **OnlineCompiler.io (Recommended)**: Visit [api.onlinecompiler.io](https://api.onlinecompiler.io), register for a free account, go to **API Keys**, and generate an API key (`ONLINECOMPILER_API_KEY`). Provides 10,000 free executions/month without a credit card.

### Step 3: Deploy to Vercel
1. Push the repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New... -> Project**.
3. Import the repository and set the **Root Directory** to `apps/web`.
4. In **Environment Variables**, paste all production variables specified in Section 3.
5. Click **Deploy**. Vercel will build the production bundle and assign a public HTTPS domain.

### Step 4: Bootstrap the Administrator Account
Run the bootstrap script locally or in a deployment task to create the initial admin user safely:
```bash
SKILLPILOT_ADMIN_EMAIL="admin@your-domain.com" \
SKILLPILOT_ADMIN_PASSWORD="StrongSecureAdminPassword123!" \
SKILLPILOT_ADMIN_NAME="Platform Administrator" \
DATABASE_URL="<your-neon-database-url>" \
DATABASE_SSL=true \
node apps/web/scripts/bootstrap-admin.mjs
```

---

## 6. Pre-Launch Verification Checklist

- [x] TypeScript compiler passes with 0 errors (`npm run typecheck`).
- [x] Unit test suite passes with 100% success (`npm test` — 161/161 tests passing).
- [x] Comprehensive integration suite passes live against Neon database (`31/31 passing`).
- [x] Origin validation blocks cross-origin CSRF attempts (`requireOrigin`).
- [x] LiveKit token generation and HMAC-SHA256 signature verification pass.
- [x] Public Piston 401 whitelist is handled honestly without crashing or falsifying passes.
- [x] SQL practice problems run in isolated in-memory SQLite sandbox with 0 production database leakage.
- [x] Quota exhaustion triggers Solution Drafting Mode without awarding unearned skill evidence.
- [x] Client cookies set with `Secure; HttpOnly; SameSite=Lax`.
- [x] Zero server secrets exposed to browser bundles.
