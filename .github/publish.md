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

Tag-driven. From `main`, once the release commit is merged:

```sh
git checkout main
git pull --ff-only
git tag v0.2.0
git push origin v0.2.0
```

The `Publish to GitHub Packages` workflow
([`.github/workflows/publish.yml`](workflows/publish.yml)) runs on any
tag matching `v*`:

1. Checkout the tagged commit (full history).
2. **Verify the tagged commit is on `main`.** `git merge-base
   --is-ancestor $GITHUB_SHA origin/main` — if a tag is pushed on a
   commit that is not an ancestor of `main`, the workflow fails fast
   and no publish happens. This defends against mistagged or crafted
   tags on unreviewed commits.
3. Install deps with pnpm (frozen lockfile).
4. Typecheck + build both packages.
5. `pnpm -r publish --no-git-checks --access restricted` with
   `NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` — the built-in token
   with `packages: write`. No long-lived PAT on the publisher side.

Pre-releases (`v0.2.0-rc1`, `-beta.2`, etc.) follow the same path —
the `v*` pattern matches; npm handles the `dist-tag` correctly based
on the version string.

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
   `gh run list --workflow publish.yml --branch v0.2.0 --limit 1`.
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
node -e "require('@benoit-bremaud/feedback-widget')"
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
