# Branch protection — `main`

This document is the canonical reference for how branch protection is
configured on `main`. It is committed so the config can be replayed,
diffed, or audited without needing access to the GitHub UI.

## Policy

- Pull request required before merge (no direct pushes to `main`)
- Required status checks (strict / up-to-date branch):
  - `build-test`
  - `SonarCloud Code Analysis`
- Linear history required (squash/rebase only, no merge commits)
- Force-pushes blocked
- Deletions blocked
- `required_approving_review_count`: **0** — this is a solo-dev project,
  so explicit approval is not enforced. The CI gate + author
  self-review + automated reviewers (Copilot, Codex) act as the
  review signal. Revisit if a second maintainer joins.
- `enforce_admins`: **false** — the repository owner keeps a bypass
  for emergency recovery (broken `main`, revert of a bad merge, etc.).
  The intent is still to always go through a PR; the bypass exists
  only as an escape hatch.
- No code-owner reviews, no signed-commit requirement (deferred).

## Apply / update

Run this command (idempotent — overwrites the current protection
config with what is declared here):

```bash
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection \
  -X PUT --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build-test", "SonarCloud Code Analysis"]
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

```bash
# Read current protection
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection

# Attempt a direct push (should be rejected)
git push origin main

# Attempt a force-push (should be rejected)
git push --force origin main

# Attempt to delete main remotely (should be rejected)
git push origin --delete main
```

## Remove (if ever needed)

```bash
gh api repos/benoit-bremaud/feedback-widget/branches/main/protection -X DELETE
```
