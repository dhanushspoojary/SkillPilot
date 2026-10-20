# SkillPilot Production Deployment & Infrastructure Guide

**Project**: SkillPilot  
**Workspace**: `apps/web`  
**Node.js**: >= 18.0.0 (v20+ Recommended)  
**Database**: PostgreSQL 14+ or Neon Serverless PostgreSQL  
**Last Updated**: 2026-10-19  

---

## 1. Hosting Architecture Overview

SkillPilot can be hosted using either a modern serverless platform (e.g. Vercel, Railway, Render) or containerized on any Linux cloud host (e.g. AWS ECS, GCP Cloud Run, DigitalOcean, self-hosted Docker Compose).

```
                      +-----------------------------+
                      |       Public Internet       |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Cloudflare / WAF / CDN    |
                      |   (SSL, DDoS & Rate Limit)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |      Reverse Proxy          |
                      |   (Caddy / Nginx / Traefik) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |    Next.js Web Application  |
                      |    (Port 3000 / SSR & APIs) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     PostgreSQL Database     |
                      |   (Schema, Tables, Indexes) |
                      +-----------------------------+
```

---

## 2. Environment Variables Specification

> **CRITICAL SECURITY NOTE**: Never commit actual secret values into version control. Configure these variables directly in your deployment platform's secret manager or a secure `.env.local` file.

| Environment Variable Name | Required? | Purpose / Description | Example Placeholder |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection URI with SSL mode enabled. | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `SESSION_SECRET` | **Required** | High-entropy random secret (>= 32 chars) for cookie HMAC verification. | `generate_random_32_byte_hex_string` |
| `SKILLPILOT_ALLOWED_ORIGIN` | **Required** | Exact canonical HTTPS origin of your website for CSRF checking. | `https://skillpilot.example.com` |
| `SKILLPILOT_SECURE_COOKIES` | Optional | Set to `true` in production to enforce `Secure; HttpOnly; SameSite=Lax`. | `true` |
| `NODE_ENV` | Optional | Sets Node environment to production mode. | `production` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for live conversational AI and tutoring. | `AIzaSy...` |
| `ANTHROPIC_API_KEY` | Optional | Alternative LLM key for Anthropic Claude (if configured). | `sk-ant-...` |
| `JUDGE0_API_URL` | Optional | Base URL of an isolated Judge0 code execution runner API. | `https://judge0-ce.p.rapidapi.com` or `http://localhost:2358` |
| `JUDGE0_API_KEY` | Optional | API key for authenticated Judge0 instances (e.g. RapidAPI). | `your_judge0_api_key` |
| `JUDGE0_API_HOST` | Optional | Host header when using RapidAPI proxy for Judge0. | `judge0-ce.p.rapidapi.com` |
| `PISTON_API_URL` | Optional | Alternative execution sandbox URL (Piston v2). Used if Judge0 is unconfigured. | `https://emkc.org/api/v2/piston` |
| `LIVEKIT_URL` | Optional | WebSocket URL for live WebRTC video/audio rooms. | `wss://skillpilot.livekit.cloud` or `ws://localhost:7880` |
| `LIVEKIT_API_KEY` | Optional | API Key for LiveKit token issuance (never expose to client). | `APILiveKitKey...` |
| `LIVEKIT_API_SECRET` | Optional | API Secret for LiveKit token signing (HMAC-SHA256). | `SecretLiveKitSecret...` |

---

## 2.1 Code Execution Infrastructure (Judge0 / Piston)

### Option A: Cloud Judge0 (RapidAPI)
1. Subscribe to Judge0 CE on RapidAPI.
2. Configure environment variables in `apps/web/.env.local`:
   ```bash
   JUDGE0_API_URL="https://judge0-ce.p.rapidapi.com"
   JUDGE0_API_KEY="your-rapidapi-key"
   JUDGE0_API_HOST="judge0-ce.p.rapidapi.com"
   ```
3. Test health: `curl -H "X-RapidAPI-Key: $JUDGE0_API_KEY" https://judge0-ce.p.rapidapi.com/system_info`

### Option B: Self-Hosted Judge0 (Docker)
1. Run official Judge0 CE Docker containers:
   ```bash
   docker run -d --name judge0-server -p 2358:2358 judge0/judge0:latest
   ```
2. Configure environment:
   ```bash
   JUDGE0_API_URL="http://localhost:2358"
   ```
3. Test health: `curl http://localhost:2358/system_info`

### Option C: Self-Hosted Piston
1. Run Piston in Docker:
   ```bash
   docker run -d --name piston -p 2000:2000 ghcr.io/engineer-man/piston
   ```
2. Configure environment:
   ```bash
   PISTON_API_URL="http://localhost:2000/api/v2/execute"
   ```

*Note: If no code execution URL is configured, SkillPilot operates in safe **Solution Drafting Mode**.*

---

## 2.2 LiveKit Real-Time WebRTC Video Infrastructure

### Option A: LiveKit Cloud (Recommended)
1. Create a free project at [cloud.livekit.io](https://cloud.livekit.io).
2. Generate an API Key and Secret from Project Settings -> Keys.
3. Configure environment variables in `apps/web/.env.local`:
   ```bash
   LIVEKIT_URL="wss://your-project.livekit.cloud"
   LIVEKIT_API_KEY="your-api-key"
   LIVEKIT_API_SECRET="your-api-secret"
   ```

### Option B: Self-Hosted LiveKit Server (Docker)
1. Start local LiveKit development server:
   ```bash
   docker run -d --name livekit-server \
     -p 7880:7880 \
     -p 7881:7881 \
     -p 7882:7882/udp \
     livekit/livekit-server:latest \
     --dev --bind 0.0.0.0 \
     --key-file /dev/null \
     --keys "devkey: secret"
   ```
2. Configure environment:
   ```bash
   LIVEKIT_URL="ws://localhost:7880"
   LIVEKIT_API_KEY="devkey"
   LIVEKIT_API_SECRET="secret"
   ```

*Note: If LiveKit credentials are unset, the mentor call component renders an honest offline notice while preserving fallback meeting links (Google Meet, Zoom, Teams, Jitsi).*

---

## 3. Database Migration & Initialization

The schema is maintained in `db/schema.sql` and includes append-only constraints, foreign key cascades, and indexing for high performance.

### Applying the Schema:
```bash
# Using standard psql client:
psql "$DATABASE_URL" -f db/schema.sql

# Or using Neon / cloud web console:
# Paste and execute the contents of db/schema.sql in the SQL Editor.
```

### Seeding Initial Admin Account:
To bootstrap the initial administrator safely without exposing credentials over HTTP:
```bash
# Set environment variables for the bootstrap script:
SKILLPILOT_ADMIN_EMAIL="admin@skillpilot.example" \
SKILLPILOT_ADMIN_PASSWORD="YourStrongUniqueAdminPassword123!" \
SKILLPILOT_ADMIN_NAME="Platform Administrator" \
node scripts/bootstrap-admin.mjs
```

---

## 4. Local Development vs. Production Build Commands

### Local Development:
```bash
# Install dependencies
npm install

# Start local Next.js dev server on port 3000
npm run dev
```

### Production Build:
> [!IMPORTANT]
> If a local dev server (`next dev`) is running, STOP IT before executing `next build` to prevent chunk file collisions in `.next/`.

```bash
# Stop any active dev server
# Then run the production build:
npm run build

# Start the production server:
npm run start
```

---

## 5. Docker Deployment

A complete container setup is provided via `docker-compose.full.yml`:

```bash
# Build and run the entire stack in the background:
docker compose -f docker-compose.full.yml up -d --build

# View container logs:
docker compose -f docker-compose.full.yml logs -f web

# Stop containers:
docker compose -f docker-compose.full.yml down
```

---

## 6. Pre-Launch Verification Checklist

Before opening the site to real users:
1. [ ] Confirm `DATABASE_URL` connects to a resilient database with automated backups.
2. [ ] Confirm `SKILLPILOT_ALLOWED_ORIGIN` matches your exact public domain (with `https://`).
3. [ ] Confirm `SKILLPILOT_SECURE_COOKIES=true` is set.
4. [ ] Run `npm run typecheck` to verify 0 TypeScript compiler errors.
5. [ ] Run `npm test` to verify all 140+ unit tests pass.
6. [ ] Verify `/p/[handle]` opens cleanly for public visitors without authentication.
7. [ ] Confirm admin bootstrap script succeeded and admin credentials are stored in a password manager.
