# Production readiness

This repository is **production-oriented**, not a claim of certification. The release process must still run the checks below in the target environment.

## Required before public launch

- [ ] Generate and commit `apps/web/package-lock.json` (the current build environment cannot reach npm registry, so this must be generated on a registry-connected machine). (see LOCKFILE_REQUIRED.md; Docker and CI use it automatically once present).
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:integration`, `npm run api:integration`, and `npm run load:smoke`.
- [ ] Configure `DOMAIN` and terminate TLS through Caddy (or an equivalent managed reverse proxy).
- [ ] Configure PostgreSQL backups and perform a restore into a fresh database.
- [ ] Run load/concurrency testing against the deployed stack.
- [ ] Run an independent penetration test before handling sensitive production data.
- [ ] Configure centralized logs, metrics and alerting.
- [ ] Rotate all production secrets after any test/development exposure.

## Security invariants

This release adds fail-closed production configuration checks, admin endpoint rate limits, mentor skill allowlisting, serialized last-admin deletion, and database-level protection around the account-deletion function. These controls reduce common authorization, abuse, and configuration failure modes but do not replace independent penetration testing.

- Browser state is never authoritative for scores/evidence.
- Assessment answer keys remain server-side.
- Only approved mentors are discoverable.
- Mentor reviews and evidence are server-created and append-only.
- Password-change, login, signup and agent endpoints are rate-limited in PostgreSQL.
- Agent hourly quotas are per-user, with a separate global safety ceiling.
- Public traffic enters through the TLS reverse proxy; the application container is not published directly.
- CSP script execution uses a per-response nonce; `script-src 'unsafe-inline'` is not permitted.

The remaining checklist items are operational validation, not features that can honestly be marked complete without running them against the deployment environment.

## Feature release gates

- [ ] Verify mentor request → accept → chat → meeting link end-to-end with two real accounts.
- [ ] Verify chat reports appear in the admin moderation workspace.
- [ ] Verify voice mock interview works with browser speech recognition and typed fallback.
- [ ] Verify AI scoring falls back safely when the provider is unavailable.
- [ ] Verify practice evidence is stored at reduced confidence and cannot be browser-created.
