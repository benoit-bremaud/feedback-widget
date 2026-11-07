# Branch protection — `main`

This document is the canonical reference for how branch protection is
configured on `main`. It is committed so the config can be replayed,
diffed, or audited without needing access to the GitHub UI.

> **Not currently applied.** `GET /repos/.../branches/main` reports
> `protected: false`, and the protection API answers `403 — Upgrade to
GitHub Pro or make this repository public`. Branch protection is a paid
> feature for private repositories, so nothing below is in force today:
> **direct pushes to `main` succeed**. Always check
> `git branch --show-current` before committing. The pre-push hook
> described in [CONTRIBUTING.md](../CONTRIBUTING.md#local-ci--the-four-tiers)
> is the interim control. Apply this configuration the day the repo goes
> public or the plan changes.

## Policy

- Pull request required before merge (no direct pushes to `main`)
- Required status checks (strict / up-to-date branch):
  - `gate` (commit status written by `scripts/attest.sh write gate`, #163)
- Linear history required (squash/rebase only, no merge commits)
- Force-pushes blocked
- Deletions blocked
- `required_approving_review_count`: **0** — this is a solo-dev project,
  so explicit approval is not enforced. The attested `just gate` +
  author self-review + the `review-local` report act as the review
  signal (no hosted reviewer, see CLAUDE.md). Revisit if a second maintainer joins.
- `enforce_admins`: **false** — the repository owner keeps a bypass
  for emergency recovery (broken `main`, revert of a bad merge, etc.).
  The intent is still to always go through a PR; the bypass exists
  only as an escape hatch.
- No code-owner reviews, no signed-commit requirement (deferred).

## Apply / update

The only status a PR head can carry is written by the local CI, not by a
workflow (#163, skill `local-ci`):

- `gate` — set by `scripts/attest.sh write gate` at the end of `just gate`,
  together with a signed note on `refs/notes/gate`; `just merge <n>`
  verifies both before merging.

The former checks `build-test`, `lint` and `Secret detection` belonged to
workflows removed in #163 (`ci.yml`, `lint.yml`, `gitleaks.yml`); a
protection rule that still required them would block every merge.

`SonarCloud Code Analysis` **was** listed here and has been removed:
SonarCloud's free plan analyzes public projects only, so that check can
never report on this repo, and a required check that never reports blocks
every merge permanently. This file warned about exactly that failure mode
— honour it: a check listed here that stops reporting must be removed in
the same change that retires it.

Run this command (idempotent — overwrites the current protection
config with what is declared here):

```bash
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection \
  -X PUT --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["gate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false,
  "restrictions": null
}
EOF
```

## Verify

Use a collaborator account with **write access but not admin/owner**
for the rejection checks below. This is important: read-only access
would also reject the commands, but for the wrong reason (insufficient
permission instead of branch protection), so the test would not prove
the policy is active. Conversely, because `enforce_admins` is `false`,
the owner is allowed to push, force-push, or delete `main` as an
emergency bypass, so the commands will **not** be rejected when run
as the owner even though the protection is active.

This project is currently solo, so a matching non-admin-with-write
account does not exist today. Until a second collaborator is added,
the only reliable verification is the first command (reading the
protection payload); the rest become meaningful once such an account
is available.

Each rejection test below must actually attempt a real change — a
bare `git push origin main` when local and origin already match is a
no-op (`Everything up-to-date`) and would falsely pass even if
protection were not enforced. The commands below create concrete
divergence before pushing, and clean up after.

```bash
# Read current protection (owner: reliable)
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection

# Direct-push test: create a real local commit, then try to push it.
git checkout main
git pull --ff-only
git commit --allow-empty -m "verify: branch-protection direct-push test"
git push origin main                   # expected: rejected for non-admins
git reset --hard origin/main           # cleanup (discard the local commit)

# Force-push test: rewrite the last commit to diverge from origin.
git commit --amend --no-edit --date=now
git push --force origin main           # expected: rejected for non-admins
git reset --hard origin/main           # cleanup (re-align with origin)

# Delete test: concrete attempt, no setup needed.
git push origin --delete main          # expected: rejected for non-admins
```

## Remove (if ever needed)

```bash
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection -X DELETE
```
