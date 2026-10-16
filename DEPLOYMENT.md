# SkillPilot production deployment

## 1. Configure secrets
Copy `.env.example` to your deployment environment and set:

- `POSTGRES_PASSWORD`
- `SKILLPILOT_DB_APP_PASSWORD` (different random password for the web application role)
- `SKILLPILOT_ALLOWED_ORIGIN=https://your-real-domain.example`
- `SKILLPILOT_SECURE_COOKIES=true` for HTTPS production (use `false` only for local HTTP testing)
- `ANTHROPIC_API_KEY` (optional; without it the agent uses the deterministic fallback)
- `ANTHROPIC_MODEL`

Do not commit `.env` files.

## 2. Start the database and application

```bash
docker compose -f docker-compose.full.yml up -d --build
```

PostgreSQL is private to the compose network and is not published to the host.

## 3. Create the first administrator
Run this from a trusted deployment machine:

```bash
docker compose -f docker-compose.full.yml exec \
  -e SKILLPILOT_ADMIN_EMAIL=admin@example.com \
  -e SKILLPILOT_ADMIN_PASSWORD='use-a-unique-16+-character-password' \
  -e SKILLPILOT_ADMIN_NAME='SkillPilot Admin' \
  web node scripts/bootstrap-admin.mjs
```

If PostgreSQL is not exposed locally, run the command from a one-off container attached to the compose network.

## 4. Public reverse proxy
Put HTTPS in front of port 3000. Set `SKILLPILOT_ALLOWED_ORIGIN` to the exact HTTPS origin.

For a public deployment, add WAF controls for:
- login/signup bursts;
- `/api/agent` cost abuse;
- `/api/mentors` harvesting;
- repeated assessment submissions;
- suspicious automation/user-agent patterns.

## 5. Backups
Back up the PostgreSQL volume/database. Test restoration before launch.

## 6. Operational checks
Verify:
- student signup/login/logout;
- mentor signup -> pending -> admin approval -> visible to student;
- student mentor request -> mentor sees request;
- mentor review -> student evidence changes;
- assessment answer key is not present in browser network payloads;
- forged localStorage evidence does not change the server profile;
- agent reads only the logged-in student's data;
- suspended accounts cannot use protected APIs.

## Database migrations

For an existing installation, run migrations before starting the new web release:

```bash
docker compose -f docker-compose.full.yml run --rm migrate
```

For a running web container, the migration script is also included in the image:

```bash
docker compose -f docker-compose.full.yml exec web node scripts/migrate.mjs
```

Run retention manually with:

```bash
docker compose -f docker-compose.full.yml exec web node scripts/prune.mjs
```

The full Docker deployment includes a one-shot `migrate` service and waits for it before starting the web service.


## HTTPS production path

Set `DOMAIN` in `.env`. `docker compose -f docker-compose.full.yml up -d --build` publishes only Caddy on ports 80/443; the Next.js container is internal-only. Caddy obtains and renews the certificate automatically when DNS points the domain to the host. Do not publish port 3000 directly.

## Additional required settings
- `SKILLPILOT_HASH_SECRET` (compose refuses to start without it): keys the hashes of IPs and user agents written to `security_events`. Generate with `openssl rand -hex 32`.
- Migrations run through `scripts/migrate.sh` in the one-shot `migrate` service; each file and its `schema_migrations` row commit atomically.
- The agent applies per-minute, per-user hourly and global hourly limits **before** any model call is made. Tune the global ceiling with `SKILLPILOT_AGENT_GLOBAL_CAP`.

## Email, account recovery and moderation
- Set `RESEND_API_KEY` and `MAIL_FROM` (a sender verified in Resend). In production this automatically turns on **email verification**: signup answers identically whether or not the address is registered (the real owner is told by email), and sign-in requires a confirmed address. Override with `SKILLPILOT_REQUIRE_EMAIL_VERIFICATION=true|false`.
- Without a mail provider, verification is off and signup can reveal registered addresses (it returns a generic error for duplicates). Password reset links cannot be delivered either, so configure mail before a public launch.
- "Forgot password" is available on the sign-in page. Links are single-use, stored only as hashes, and expire after 1 hour (reset) or 24 hours (verification). A reset signs the user out everywhere.
- Administrators can suspend and reactivate student and mentor accounts from the admin workspace (`/api/admin/users`). Suspension ends active sessions immediately. Admin accounts cannot be changed there.

## Data retention
`agent_runs`, mentor chat messages, completed/abandoned mock interviews, and `security_events` are deleted after 90 days by default (`SKILLPILOT_RETENTION_AGENT_DAYS`, `SKILLPILOT_RETENTION_EVENTS_DAYS`); expired sessions, used tokens and rate-limit rows are cleaned too. The app does this opportunistically once an hour. For busy deployments also run `npm run prune` (apps/web) from cron.

## Secrets
`SKILLPILOT_HASH_SECRET` (16+ characters) is mandatory in production: the server refuses to start without it (see `instrumentation.ts`) instead of falling back to a development key.
