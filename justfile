# Local CI (#163, skill local-ci): four tiers, one recipe each, no GitHub and no AI agent needed.
# GitHub Actions keeps one workflow, `prod.yml`, triggered by a signed release tag (agents-skills
# ADR-0004, local-first CI/CD): it publishes both packages to GitHub Packages. Tools come from
# mise.toml (`just setup`); run through `mise x -- just <tier>` when the shell does not activate
# mise (the git hooks do). Tiers, budgets and contents: CONTRIBUTING.md § Local CI — the four tiers
# (L0 fast < 10 s on commit, L1 check < 3 min on push, L2 gate before every merge, L3 nightly on the
# systemd user timer `feedback-widget-local-ci-nightly.timer`).
#
# Then: `just merge <pr>` (refuses without the gate attestation on the head SHA), `just attest
# staging` after the QA pass of the bundle on the Worker's staging host, a signed tag for the
# release (`prod.yml`; `just publish <tag>` is the fallback when Actions cannot run). Nothing
# deploys from here: the widget is a package, the Worker repository hosts the bundle.

set shell := ["sh", "-eu", "-c"]

semgrep := "uvx semgrep@1.182.1" # via uv, not mise: a mise pipx install needs a mise-managed Python

# L1 by default
default: check

# Once per clone: the pinned toolchain, the dependencies and the git hooks
# `--reset-hooks-path`: clones from before #163 carry `core.hooksPath=.githooks`, which lefthook refuses.
setup:
    mise install
    mise x -- pnpm install --frozen-lockfile
    mise x -- lefthook install --reset-hooks-path

# L0 — the pre-commit checks on the staged files (< 10 s)
fast:
    lefthook run pre-commit

# Fail fast outside the .nvmrc Node major: a non-interactive shell does not activate mise, so another
# manager's default Node would run the suites. Fix: activate mise or run `mise x -- just …`.
[private]
node-guard:
    @node -e 'const want=require("fs").readFileSync(".nvmrc","utf8").trim().replace(/^v/,"").split(".")[0]; const v=process.versions.node; if (v.split(".")[0] !== want) { console.error("Node " + v + " found, Node " + want + " required (.nvmrc). Run: mise x -- just <recipe>"); process.exit(1) }'

# Formatting, ESLint, spelling, the workflow, the shell scripts, the hook config, doc coverage (>= 90 %)
lint: node-guard
    pnpm format:check
    pnpm lint
    typos
    actionlint
    zizmor --quiet .github/workflows
    shellcheck --severity=warning scripts/*.sh
    lefthook validate
    sh scripts/doc-coverage.sh

# The lockfile must match package.json (offline first: no network when nothing changed), build before
# typecheck (packages/web resolves the core types from its dist/), then the suites with the coverage
# floors enforced by each package's vitest config, then the tests of the CI wiring itself
test: node-guard
    pnpm install --frozen-lockfile --offline --silent || pnpm install --frozen-lockfile --silent
    pnpm build
    pnpm typecheck
    pnpm test:coverage
    sh scripts/test-local-ci.sh
    sh scripts/test-attest.sh

# SAST (Semgrep Community Edition on the shipped sources, tests excluded by .semgrepignore) and known
# vulnerabilities in the lockfile. EIO_BACKEND=posix: semgrep-core otherwise opens io_uring rings
# charged to RLIMIT_MEMLOCK and dies with "Cannot allocate memory" when Electron apps spent it.
security:
    EIO_BACKEND=posix {{semgrep}} scan --config p/default --error --metrics=off --quiet packages/core/src packages/web/src scripts
    osv-scanner scan source --config osv-scanner.toml --lockfile pnpm-lock.yaml

# Secrets in the whole git history
secrets:
    gitleaks git --redact --no-banner .

# L1 — pre-push (< 3 min)
check: lint test security secrets

# L2 — pre-merge, called by review-local § 2b (base: the branch to integrate into), 5–15 min.
# SonarQube: the self-hosted instance (sonar-project.properties, quality gate waited for) with
# SONAR_TOKEN exported; missing either fails the gate (skill local-ci rule 2). A changed workflow is
# rehearsed with act; Docker down then exits 3 before the attestation (incomplete, never green). Ends
# with the gate attestation (agents-skills ADR-0003): commit status `gate` + signed note on HEAD, which
# must already be pushed, so it runs on the pushed head only.
gate base="origin/main": check
    #!/bin/sh
    set -eu
    base={{quote(base)}}
    case "$base" in origin/*) git fetch --quiet origin "${base#origin/}" ;; esac
    [ -n "${SONAR_TOKEN:-}" ] || { echo "gate: SONAR_TOKEN is not exported (CONTRIBUTING § Static analysis)" >&2; exit 1; }
    curl -sSf -o /dev/null --max-time 5 http://localhost:9000 \
      || { echo "gate: no SonarQube instance answering on http://localhost:9000" >&2; exit 1; }
    pnpm exec sonar-scanner-npm
    changed=$(git diff --name-only --diff-filter=d "$base...HEAD" -- .github/workflows)
    if [ -z "$changed" ]; then echo "gate: no workflow added or changed, rehearse skipped"
    elif ! docker info > /dev/null 2>&1; then
      echo "gate: WARNING docker unreachable, the changed workflow was not rehearsed"
      echo "gate: INCOMPLETE (exit 3) — start Docker and run just gate again before asking for a merge"
      exit 3
    else printf '%s\n' "$changed" | while IFS= read -r w; do just rehearse "$w"; done; fi
    sh scripts/attest.sh write gate

# Rehearse a workflow with act (L2, needs docker): dry run of the whole graph, then for the prod
# workflow (agents-skills ADR-0004) a real run of its `classify` job on fake tag events. The publish
# job never runs and act gets no secret. The tag prefix is read from the workflow's PREFIX.
rehearse workflow:
    #!/bin/sh
    set -eu
    w={{quote(workflow)}} img=ubuntu-latest=catthehacker/ubuntu:act-24.04 dir=$(git rev-parse --git-dir)
    act --dryrun -P "$img" -W "$w" < /dev/null
    grep -q '^  classify:' "$w" || exit 0
    p=$(sed -n 's/^  PREFIX: *\([^ #]*\).*/\1/p' "$w" | tr -d "'\"")
    trap 'rm -f "$dir/act-event.json" "$dir/act.log"' EXIT
    for case in "${p}1.2.3:stable" "${p}1.2.3-rc.1:prerelease" not-a-tag:refused; do
      tag=${case%:*} want=${case##*:}
      printf '{"ref":"refs/tags/%s"}\n' "$tag" > "$dir/act-event.json"
      if act push -e "$dir/act-event.json" -j classify -P "$img" -W "$w" < /dev/null > "$dir/act.log" 2>&1
      then got=$(sed -n 's/.*::set-output:: channel=//p' "$dir/act.log" | tail -1) # act 0.2.92 log format
      else got=refused; fi
      [ "$got" = "$want" ] || { cat "$dir/act.log"; echo "rehearse: $tag gave '$got', expected $want" >&2; exit 1; }
    done
    echo "rehearse: $w classify ok (stable, prerelease, refused)"

# Merge a PR only when its exact head SHA carries the gate attestation (agents-skills ADR-0003)
merge pr:
    #!/bin/sh
    set -eu
    sha=$(gh pr view {{quote(pr)}} --json headRefOid -q .headRefOid)
    git fetch --quiet origin "$sha"
    sh scripts/attest.sh verify gate "$sha"
    gh pr merge {{quote(pr)}} --squash --match-head-commit "$sha"

# Record the staging QA pass on the gated main commit, only after it succeeded (agents-skills
# ADR-0004). Derogation (#163): the widget deploys nowhere by itself, so "staging" is the bundle of
# this commit (`pnpm --filter @benoit-bremaud/feedback-widget build:bundle`) loaded by the Worker's
# staging host and checked there (skill qa-browser-check).
attest env:
    #!/bin/sh
    set -eu
    [ {{quote(env)}} = staging ] || { echo "attest: only staging is attested" >&2; exit 1; }
    git fetch --quiet origin main
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
      || { echo "attest: HEAD is not origin/main" >&2; exit 1; }
    sh scripts/attest.sh verify gate HEAD > /dev/null # a squash merge leaves main ungated: just gate first
    sh scripts/attest.sh write deploy/staging

# Publish a release from the laptop when Actions cannot run (agents-skills ADR-0004): the same checks
# as prod.yml, from up-to-date main (trusted recipe and verifier): stable tag, signed, gate status and
# both notes on its commit, tag = manifest versions; built and published from that commit, then back
# to the branch. Needs NODE_AUTH_TOKEN: a fine-grained token `fw-publish-fallback-<yyyy>` with
# packages:write, 30-day expiry, revoked after use (.github/publish.md). Log the run in PROJECT_LOG.md.
publish tag:
    #!/bin/sh
    set -eu
    tag={{quote(tag)}}
    [ -z "$(git status --porcelain)" ] || { echo "publish: commit or stash local changes first" >&2; exit 1; }
    [ -n "${NODE_AUTH_TOKEN:-}" ] || { echo "publish: NODE_AUTH_TOKEN is not exported (packages:write)" >&2; exit 1; }
    git fetch --quiet origin main tag "$tag"
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
      || { echo "publish: run the fallback from up-to-date main" >&2; exit 1; }
    sha=$(sh scripts/attest.sh release "$tag")
    git merge-base --is-ancestor "$sha" origin/main || { echo "publish: $tag is not on main" >&2; exit 1; }
    back=$(git symbolic-ref --quiet --short HEAD || git rev-parse HEAD)
    rc="$(git rev-parse --git-dir)/publish.npmrc"
    trap 'rm -f "$rc"; git checkout --quiet "$back"' EXIT
    git -c advice.detachedHead=false checkout --quiet "$sha"
    sh scripts/check-release-version.sh "$tag"
    pnpm install --frozen-lockfile
    pnpm -r build
    pnpm -r typecheck
    # What setup-node does in prod.yml; single quotes: the file holds the variable name, never the token
    printf '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n' > "$rc"
    NPM_CONFIG_USERCONFIG="$rc" pnpm -r publish --no-git-checks --access restricted --tag latest
    echo "publish: $tag ($sha) published by the local fallback: log it in PROJECT_LOG.md"

# L3 — nightly, systemd user timer feedback-widget-local-ci-nightly.timer (no time budget)
nightly: check
    trufflehog git "file://$PWD" --no-verification --fail --no-update
    mise outdated
