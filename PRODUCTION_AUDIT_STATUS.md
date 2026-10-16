# Production audit status

## Fixed in this release
- Mock interview scoring has a 30-second provider timeout and stale `scoring` jobs older than two minutes can be retried instead of becoming permanent dead ends.
- Mentor chat, chat reports, and meeting-link reads remain available after a request is completed by a mentor review. New meeting-link writes still require `accepted`.
- Docker now copies migration/prune scripts and migration files into the web image. Compose explicitly passes the allowed origin and trusted-proxy settings.
- The compose deployment uses a separate `skillpilot_app` database login; evidence and mentor-review UPDATE/DELETE are revoked from that role. Account deletion uses a narrowly scoped owner-side security-definer procedure.
- Agent run output no longer stores the full user question/body; only operational metadata is retained.
- Chat and completed/abandoned mock-interview retention is included in the existing pruning path.
- The assessment now treats all six core skills as assessable and uses difficulty-weighted scoring.
- HSTS `preload` was removed; preload should only be enabled deliberately after a stable domain-wide HTTPS policy is confirmed.

## Still requires a real deployment-machine step
- `apps/web/package-lock.json` is not fabricated. The build environment used for this archive could not reach the npm registry, so generate it with `npm install` on a connected machine, commit it, then use `npm ci`.
- Run `npm audit` on that connected machine and review any high/critical findings before public launch.
- MFA (at least admin), independent mentor credential verification, and automated off-host backups are deployment/security features that still need product-specific policy and infrastructure choices.
- Password hashing is still bcryptjs for compatibility with existing stored hashes; a future migration can move accounts to Node's native scrypt without forcing a password reset.
