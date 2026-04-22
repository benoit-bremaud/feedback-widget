# Tag protection — `v*` release tags

This document is the canonical reference for how tag protection is
configured on release tags (`v*`). It is committed so the config can
be replayed, diffed, or audited without needing access to the GitHub
UI. Companion doc to [branch-protection.md](./branch-protection.md).

## Policy

- Protection target: **repository ruleset**, scope `tag`,
  ref pattern `refs/tags/v*`
- Rules enforced:
  - **Creation blocked** — no non-admin can cut a new `v*` tag
  - **Update blocked** — no non-admin can move an existing `v*` tag
    to a different commit
  - **Deletion blocked** — no non-admin can delete a `v*` tag
- Enforcement: **active** (not `evaluate`, not `disabled`)
- Bypass: `RepositoryRole: Admin` (`actor_id: 5`), mode `always` —
  the repository owner keeps a bypass for emergency recovery, for
  routine releases (the owner cuts every tag today), and for the
  tag-driven `publish.yml` workflow path.

The admin bypass mirrors the escape-hatch pattern used on `main`
(`enforce_admins: false` in `branch-protection.md`). The intent is
still to only touch `v*` tags through the documented release process
([../CONTRIBUTING.md](../CONTRIBUTING.md) §Release workflow and
[publish.md](./publish.md)); the bypass exists for rare cases
(aborted release, accidental tag on the wrong commit).

## Scope — what this covers and what it does not

**Covered:** any ref matching `refs/tags/v*` — `v0.1.0`, `v0.1.1-rc1`,
`v0.1.1-rc2`, and every future release tag.

**Not covered:**

- Non-`v` tags (`milestone-2026-04`, for example) — unprotected.
- Existing tags are unaffected retroactively: the ruleset gates
  *future* create/update/delete actions on matching refs, it does
  not retroactively enforce anything on tags that already exist.
- The content or signature of a commit that a tag points to — that
  is covered by branch protection on `main` and by the
  main-ancestor check in `publish.yml`.

## Apply / update

Run this command (idempotent — overwrites the current ruleset with
what is declared here, assuming the ruleset ID is fetched first):

```bash
# Create the ruleset (first-time setup, when no ruleset exists yet)
gh api repos/benoit-bremaud/feedback-widget/rulesets \
  -X POST --input - <<'EOF'
{
  "name": "Protect v* release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/tags/v*"],
      "exclude": []
    }
  },
  "rules": [
    {"type": "creation"},
    {"type": "update"},
    {"type": "deletion"}
  ],
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ]
}
EOF

# Update the ruleset (once it exists — substitute RULESET_ID from the
# list command below, or capture it on create with --jq '.id')
RULESET_ID=$(gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags") | .id')
gh api repos/benoit-bremaud/feedback-widget/rulesets/$RULESET_ID \
  -X PUT --input - <<'EOF'
{
  "name": "Protect v* release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/tags/v*"],
      "exclude": []
    }
  },
  "rules": [
    {"type": "creation"},
    {"type": "update"},
    {"type": "deletion"}
  ],
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ]
}
EOF
```

## Verify

Use a collaborator account with **write access but not admin/owner**
for the rejection checks below. This is important: read-only access
would also reject the commands, but for the wrong reason (insufficient
permission instead of tag protection), so the test would not prove
the policy is active. Conversely, because the admin `bypass_actor` is
present, the owner is allowed to create, update, or delete `v*` tags
as part of the release process, so the commands will **not** be
rejected when run as the owner even though the protection is active.

This project is currently solo, so a matching non-admin-with-write
account does not exist today. Until a second collaborator is added,
the only reliable verification is the first command (listing the
ruleset and confirming its configuration); the rejection tests below
become meaningful once such an account is available.

```bash
# List the ruleset and confirm it is active (owner: reliable)
gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags")'

# Fetch full ruleset detail (rules + bypass actors)
RULESET_ID=$(gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags") | .id')
gh api repos/benoit-bremaud/feedback-widget/rulesets/$RULESET_ID

# Existing tags still readable
gh api repos/benoit-bremaud/feedback-widget/tags \
  --jq '.[] | .name'
# expected: v0.1.1-rc2, v0.1.1-rc1, v0.1.0

# Create rejection test (non-admin — future): attempt to cut a test tag.
git tag v-protection-test HEAD
git push origin v-protection-test          # expected: rejected for non-admins
git tag -d v-protection-test               # cleanup local

# Update rejection test (non-admin — future): move an existing tag.
git tag -f v0.1.0 HEAD                      # reassign v0.1.0 locally
git push --force origin v0.1.0              # expected: rejected for non-admins
git fetch --tags --force origin             # cleanup local (re-align with origin)

# Delete rejection test (non-admin — future): delete an existing tag.
git push origin --delete v0.1.0             # expected: rejected for non-admins
```

## Remove (if ever needed)

```bash
RULESET_ID=$(gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags") | .id')
gh api repos/benoit-bremaud/feedback-widget/rulesets/$RULESET_ID -X DELETE
```
