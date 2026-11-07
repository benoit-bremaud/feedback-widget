# Publish policy — GitHub Packages

This document is the canonical reference for how the widget packages
are published, and how a consumer project authenticates to install
them. It is committed so the config can be replayed, audited, and
diffed without UI access.

## What gets published

Two packages, both scoped to `@benoit-bremaud`:

- [`@benoit-bremaud/feedback-widget-core`](../packages/core) — pure
  logic (DOM-free, runtime-agnostic).
- [`@benoit-bremaud/feedback-widget`](../packages/web) — browser
  implementation (Web Component, fetch transport, outbox, rate
  limiter). Depends on `-core`.

Both publish to the **GitHub Packages** registry
(`https://npm.pkg.github.com`). The repo is private, the registry is
private; a PAT with `read:packages` is required to install. Public-npm
migration is intentionally deferred (see issue #22 for the current
plan, and a future issue for the public-audit path).

## How a release is cut

Tag-driven. From `main`, once the release commit is merged, gated
(`just gate`) and attested after the staging QA pass (`just attest staging`):

```sh
git checkout main
git pull --ff-only
git tag -s v0.8.0 -m v0.8.0
git push origin v0.8.0
```

The `prod` workflow ([`.github/workflows/prod.yml`](workflows/prod.yml)),
the only one of this repository (#163, agents-skills ADR-0004), runs on any
tag matching `v*`:

1. `classify`: `vX.Y.Z` → stable, `vX.Y.Z-rc.N` / `-beta.N` / `-alpha.N`
   → prerelease, anything else fails.
2. Checkout the tagged commit (full history, no persisted credentials),
   then fetch the annotated tag and `main`.
3. **Verify with the trusted copies of `main`**, never the tagged ones.
   Stable: `scripts/attest.sh release <tag>` — SSH signature against
   `.github/allowed_signers`, peel to the commit, commit status `gate`
   and the signed `deploy/staging` note on it. Prerelease: signature
   against the same trust store and `git merge-base --is-ancestor`
   on `main`. Any failure stops the job before the install.
4. Install deps with pnpm (frozen lockfile, no cache restored on a
   publish run), build, typecheck both packages.
5. `pnpm -r publish --no-git-checks --access restricted --tag <dist-tag>`
   with `NODE_AUTH_TOKEN=${{ github.token }}` — the run's token with
   `packages: write`, given to that step only. No long-lived PAT on the
   publisher side.

When Actions cannot run, `just publish vX.Y.Z` performs the same
checks and the publish from up-to-date `main` (skill `local-ci`); log
it in `PROJECT_LOG.md`.

### Stable vs prerelease dist-tag

The workflow derives the npm `--tag` from the git tag name before
publishing, so a prerelease never becomes the default install:

- Stable (`v0.2.0`, `v1.0.0`) → `--tag latest`. Consumers running
  `pnpm add @benoit-bremaud/feedback-widget` get this version.
- Prerelease (`v0.8.0-rc.1`, `v0.8.0-beta.2`, `v1.0.0-alpha.1`) →
  `--tag rc`. Consumers who want the prerelease must opt in with
  `pnpm add @benoit-bremaud/feedback-widget@rc`, which never
  promotes the prerelease to the default install for anyone else.

The channel comes from the `classify` job's regular expressions
(canonical semver, dotted pre-release counter from 1); a tag that
matches neither fails the run.

## Consumer-side installation

### `.npmrc` template

Add this `.npmrc` at the consumer project root (can be committed,
since it contains no secret — the token comes from env):

```ini
@benoit-bremaud:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

The `${GITHUB_TOKEN}` is expanded by pnpm/npm from the process env,
never written into the file itself.

### Install

```sh
export GITHUB_TOKEN="<your-PAT-with-read:packages>"
pnpm add @benoit-bremaud/feedback-widget
```

### Required PAT scopes

- **Classic PAT** — `read:packages`.
- **Fine-grained PAT** — `Packages: Read` on this repository
  specifically (or on the owner's packages collectively).

Do not use a PAT with broader scopes — `read:packages` is the only
right the consumer needs to install.

## Consumer CI authentication

Store the PAT as a repository secret in the consumer project, then:

```yaml
- name: Install dependencies
  env:
    GITHUB_TOKEN: ${{ secrets.FEEDBACK_WIDGET_READ_TOKEN }}
  run: pnpm install
```

The name `FEEDBACK_WIDGET_READ_TOKEN` is suggested for clarity — the
secret is a read-only token for this specific feedback-widget
distribution channel, distinct from the CI's `GITHUB_TOKEN` which
would not have `read:packages` for this private repo.

## Token rotation

- Consumer PATs: **90-day expiry**, rotated on calendar or whenever
  a new major release ships. Set GitHub to send expiry reminders.
- The publisher side uses the built-in `GITHUB_TOKEN` on each run —
  nothing to rotate.
- If a consumer PAT is ever leaked, revoke it at
  `https://github.com/settings/tokens`, then update the consumer
  secret with a fresh token. No package republish needed.

## Verify the workflow end-to-end

After the release tag has been pushed, confirm:

1. Actions run green on the tag:
   `gh run list --workflow prod.yml --branch v0.8.0 --limit 1`.
2. Both packages are listed at
   [`https://github.com/benoit-bremaud/feedback-widget/packages`](https://github.com/benoit-bremaud/feedback-widget/packages).
3. A fresh consumer install works:

```sh
mkdir /tmp/feedback-widget-install-test && cd /tmp/feedback-widget-install-test
cat > .npmrc <<'EOF'
@benoit-bremaud:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF
pnpm init -y
export GITHUB_TOKEN="<your-PAT-with-read:packages>"
pnpm add @benoit-bremaud/feedback-widget
node --input-type=module -e "await import('@benoit-bremaud/feedback-widget')"
```

## Remove / unpublish (emergency only)

GitHub Packages supports package deletion via the Web UI:

- Navigate to the package page under
  [`.../feedback-widget/packages`](https://github.com/benoit-bremaud/feedback-widget/packages).
- Delete a specific version or the whole package.

Version deletion is irreversible — the version number is permanently
burned (no re-publish under the same tag). Prefer publishing a fix
version (`v0.2.1`) over deletion.

The `npm unpublish` command does not work for GitHub Packages.
