# Dependency lockfile

Production and CI require `apps/web/package-lock.json`. Generate it with Node/npm in an environment with registry access, commit it, and use `npm ci`.

The release archive was not allowed to fabricate a lockfile when the npm registry was unreachable. Until the lockfile is generated and committed, the Docker build intentionally fails instead of silently resolving different dependency versions.
