#!/usr/bin/env bash
# Local verification gate — everything CI used to be relied on for, run here.
#
# Ordered cheapest-first so an obvious mistake fails in seconds rather than
# after a full analysis. Fails on the FIRST failing check: the point is to
# stop and fix, not to collect a list.
#
# Usage: pnpm verify        (or ./scripts/verify.sh)
#
# A missing scanner (gitleaks, SonarQube) fails the gate. To push anyway in an
# emergency, run with VERIFY_ALLOW_SKIP=1 (exactly `1`): the skip is still printed.
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
skip() {
  if [ "${VERIFY_ALLOW_SKIP:-}" = 1 ]; then
    printf '\033[33m⚠ skipped — %s\033[0m\n' "$1"
  else
    printf '\033[31m✘ %s (set VERIFY_ALLOW_SKIP=1 to skip on purpose)\033[0m\n' "$1" >&2
    exit 1
  fi
}

step 'Lockfile'
# Offline first (fast, no network); a cold pnpm store (fresh clone, pruned
# store) falls back to a networked install. Both fail on a lockfile drift.
pnpm install --frozen-lockfile --offline --silent 2>/dev/null ||
  pnpm install --frozen-lockfile --silent

step 'Formatting'
pnpm format:check

step 'Lint'
pnpm lint

step 'Secret detection'
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . --no-banner
else
  # Not silent: a missing scanner must be visible, not assumed clean.
  skip 'gitleaks is not installed (https://github.com/gitleaks/gitleaks)'
fi

step 'Doc coverage'
./scripts/doc-coverage.sh

step 'Build'
pnpm build

step 'Typecheck'
pnpm typecheck

step 'Tests + coverage'
pnpm test:coverage

step 'Static analysis'
# SonarQube needs a running instance and a personal token; neither belongs in
# the repo. Missing either is reported, never silently passed over.
# `pnpm exec` rather than a bare call: the pre-push hook runs this script
# directly, without node_modules/.bin on PATH.
if [ -z "${SONAR_TOKEN:-}" ]; then
  skip 'SONAR_TOKEN is not exported (see CONTRIBUTING.md § Static analysis)'
elif ! curl -sSf -o /dev/null --max-time 5 http://localhost:9000 2>/dev/null; then
  skip 'no SonarQube instance answering on http://localhost:9000'
else
  pnpm exec sonar-scanner-npm
fi

printf '\n\033[32m✔ All local checks passed.\033[0m\n'
