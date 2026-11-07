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
  tag-driven `prod.yml` workflow path.

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
  _future_ create/update/delete actions on matching refs, it does
  not retroactively enforce anything on tags that already exist.
- The content of a commit that a tag points to — that is covered by
  the gate attestation `prod.yml` verifies (`scripts/attest.sh release`,
  status `gate` + signed notes on `main`); the tag signature itself is
  verified there too, against `.github/allowed_signers`.

## Apply / update

Two distinct commands, two distinct semantics:

- **First-time create** — `POST /rulesets`. **Not idempotent.** Run this
  exactly once, when no ruleset with the name `Protect v* release tags`
  exists yet. Re-running it later creates a _second_ ruleset with the
  same name, which is not what we want.
- **Subsequent updates** — `PUT /rulesets/{id}`. **Idempotent.**
  Overwrites the current config with what is declared here. Use this
  for every change after the initial bootstrap.

The correct flow is: POST once at setup, PUT for every later change.

```bash
# --- First-time create (run once, only when no ruleset exists yet) ---
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

# --- Subsequent updates (safe to re-run: idempotent PUT) ---
# Resolve RULESET_ID defensively: fail fast if the selection is empty
# (no matching ruleset — the create step was skipped) or ambiguous
# (duplicate names — someone ran the create step more than once).
RULESET_IDS=$(gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags") | .id')
RULESET_COUNT=$(printf '%s\n' "$RULESET_IDS" | sed '/^$/d' | wc -l | tr -d ' ')
if [ "$RULESET_COUNT" -ne 1 ]; then
  printf 'Expected exactly 1 ruleset named %s, found %s.\n' \
    '"Protect v* release tags"' "$RULESET_COUNT" >&2
  exit 1
fi
RULESET_ID=$(printf '%s\n' "$RULESET_IDS" | sed '/^$/d')

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

# WARNING: never run the destructive update/delete checks below as an
# admin/owner. Admin/owner credentials bypass the ruleset, so force-move
# or delete operations would actually rewrite or remove the target tag
# on the remote instead of proving the policy is active.
#
# Prerequisite: ask an owner to cut a disposable protected tag once, for
# example `v-protection-test-existing`, pointing at any commit. The
# update/delete tests then operate on that throwaway tag — never on real
# release tags like v0.1.0.

# Update rejection test (non-admin — future): move the disposable test tag.
git tag -f v-protection-test-existing HEAD  # reassign disposable tag locally
git push --force origin v-protection-test-existing   # expected: rejected for non-admins
git fetch --tags --force origin             # cleanup local (re-align with origin)

# Delete rejection test (non-admin — future): delete the disposable test tag.
git push origin --delete v-protection-test-existing  # expected: rejected for non-admins
```

## Remove (if ever needed)

```bash
RULESET_ID=$(gh api repos/benoit-bremaud/feedback-widget/rulesets \
  --jq '.[] | select(.name == "Protect v* release tags") | .id')
gh api repos/benoit-bremaud/feedback-widget/rulesets/$RULESET_ID -X DELETE
```
