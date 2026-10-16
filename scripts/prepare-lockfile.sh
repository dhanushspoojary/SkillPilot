#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --dry-run --no-audit --no-fund
printf '\nLockfile generated and npm ci consistency check passed. Commit apps/web/package-lock.json.\n'
