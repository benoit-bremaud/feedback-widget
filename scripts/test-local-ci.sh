#!/bin/sh
# Tests for the local CI wiring (#163, skill local-ci rule 7): the tiers compose (check ⊇ lint + test +
# security + secrets; gate and nightly ⊇ check), gate ends with the attestation and merge / publish verify
# it (agents-skills ADR-0003/0004), prod.yml is the only workflow, takes attest.sh from main and its
# `classify` step sorts real tag names (run here with bash, no Docker: `just rehearse` runs it under act),
# the release-version check accepts and refuses the right tag, lefthook.yml is valid and wires the
# commit-msg and pre-push hooks, the commit-msg check accepts and refuses the right subjects (100-character
# limit included), and in a throwaway repository L0 (`just fast`) passes a clean staged change, an ignored
# ESLint file and an empty stage, but refuses a staged secret and a staged typo, and the installed
# commit-msg hook refuses a bad subject. Needs mise, just, lefthook, gitleaks, typos, bash on PATH:
#   mise x -- sh scripts/test-local-ci.sh
set -e
# A hook (pre-push runs `just check`) exports these; they would aim git at the outer repository.
# shellcheck disable=SC2046 # one variable name per word
unset $(git rev-parse --local-env-vars)
# The developer's git config (signing, hooksPath) and mise trust list stay out of the throwaway repo.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
n=0
fail() { echo "FAIL $1"; exit 1; }
ok() { n=$((n + 1)); } # one counted case

# `mise x --` puts the tools on PATH but not mise itself (hooks and the throwaway repo need it).
command -v mise > /dev/null || { [ -x "$HOME/.local/bin/mise" ] && PATH="$HOME/.local/bin:$PATH" && export PATH; }
for bin in mise just lefthook gitleaks typos bash; do
  command -v "$bin" > /dev/null || fail "$bin not on PATH"
done

# Tiers and their composition (a missing recipe fails `just --show`).
cd "$root"
deps() { just --show "$1" | grep -E "^$1( |:)" | sed 's/.*: *//'; } # deps <recipe>
for d in lint test security secrets; do deps check | grep -qw "$d" || fail "check lacks $d"; ok; done
for r in gate nightly; do deps "$r" | grep -qw check || fail "$r does not depend on check"; ok; done
body() { just --show "$1" | grep -v '^ *#'; } # body <recipe>: its lines, comments dropped
body gate | grep -q '^ *sh scripts/attest.sh write gate$' || fail "gate does not write the attestation"; ok
body merge | grep -q '^ *sh scripts/attest.sh verify gate "\$sha"$' || fail "merge does not verify the attestation"; ok
body publish | grep -q '^ *sha=$(sh scripts/attest.sh release "\$tag")$' || fail "publish skips attest.sh release"; ok
body publish | grep -q 'check-release-version.sh "\$tag"' || fail "publish skips the release-version check"; ok
body attest | grep -q '^ *sh scripts/attest.sh verify gate HEAD' || fail "attest staging does not verify the gate"; ok
body attest | grep -q '^ *sh scripts/attest.sh write deploy/staging$' || fail "attest staging does not write the note"; ok
e3=$(body gate | grep -n '^ *exit 3$' | head -1 | cut -d: -f1); at=$(body gate | grep -n 'attest.sh write gate' | cut -d: -f1)
[ -n "$e3" ] && [ -n "$at" ] && [ "$e3" -lt "$at" ] || fail "gate must exit 3 (Docker down) before it writes the attestation"; ok

# The prod workflow.
wf=.github/workflows/prod.yml
[ "$(find .github/workflows -name '*.yml' -o -name '*.yaml' | wc -l)" -eq 1 ] || fail "more than one GitHub workflow (agents-skills ADR-0004: prod.yml only)"; ok
grep -q '^ *git show origin/main:scripts/attest.sh > ' "$wf" || fail "prod workflow does not take attest.sh from main"; ok
grep -q '^ *sha=$(sh "\$RUNNER_TEMP/attest.sh" release ' "$wf" || fail "prod workflow does not run attest.sh release"; ok
grep -q '^ *git merge-base --is-ancestor "\$sha" origin/main' "$wf" || fail "prod workflow does not require an ancestor of main"; ok
grep -q '^ *sh "\$RUNNER_TEMP/check-release-version.sh" ' "$wf" || fail "prod workflow skips the release-version check"; ok
grep -q '^ *run: pnpm -r publish ' "$wf" || fail "prod workflow does not publish the packages"; ok
grep -q "^ *version: $(sed -n 's/^pnpm = "\(.*\)".*/\1/p' mise.toml)" "$wf" || fail "prod.yml pnpm differs from mise.toml"; ok
grep -q "^node = \"$(cat .nvmrc)\"" mise.toml || fail "mise.toml node differs from .nvmrc"; ok
# classify, for real: the step script with bash, GITHUB_OUTPUT in a file
block=$(awk '/^  classify:/{c=1} c&&/run: \|/{r=1;next} r&&/^  publish:/{exit} r{sub(/^          /,"");print}' "$wf")
prefix=$(sed -n 's/^  PREFIX: *\([^ #]*\).*/\1/p' "$wf")
[ -n "$block" ] && [ -n "$prefix" ] || fail "cannot extract classify from $wf"
classify() { # classify <tag> <stable|prerelease|refused>
  : > "$work/gho"; rc=0
  GITHUB_REF_NAME=$1 PREFIX=$prefix GITHUB_OUTPUT="$work/gho" bash -c "$block" > /dev/null 2>&1 || rc=$?
  got=$(sed -n 's/^channel=//p' "$work/gho")
  case $2 in refused) [ "$rc" -ne 0 ] && [ -z "$got" ] ;; *) [ "$rc" -eq 0 ] && [ "$got" = "$2" ] ;; esac \
    || fail "classify $1: rc=$rc channel='$got', expected $2"; ok
}
for t in v1.2.3 v0.0.0 v10.20.30; do classify $t stable; done
for t in v1.2.3-rc.1 v1.2.3-beta.10 v1.2.3-alpha.2; do classify $t prerelease; done
for t in v01.2.3 v1.2 v1.2.3-rc.0 v1.2.3-rc1 v1.2.3-RC.1 v1.2.3+b vv1.2.3 v1.2.3-rc.1.2 x1.2.3 v1.2.3-v1.2.3; do classify $t refused; done

# Release version = manifests (every published package is at the same version).
ver=$(sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' packages/web/package.json)
sh scripts/check-release-version.sh "v$ver" > /dev/null || fail "check-release-version refused the manifest version"; ok
sh scripts/check-release-version.sh "v$ver-rc.1" > /dev/null 2>&1 && fail "check-release-version accepted a pre-release tag on stable manifests"; ok
sh scripts/check-release-version.sh v99.0.0 > /dev/null 2>&1 && fail "check-release-version accepted another version"; ok

# Hooks.
grep -qE '^ +run: +sh scripts/check-commit-msg.sh \{1\}$' lefthook.yml || fail "commit-msg hook does not run check-commit-msg.sh on the message file"; ok
grep -qE '^ +run: +mise x -- just check$' lefthook.yml || fail "pre-push hook does not run just check"; ok
lefthook validate > /dev/null || fail "lefthook validate"; ok

# commit-msg subjects.
msg() { # msg <expected-exit> <subject>
  printf '%s\n' "$2" > "$work/msg"
  rc=0; sh scripts/check-commit-msg.sh "$work/msg" > /dev/null 2>&1 || rc=$?
  [ "$rc" -eq "$1" ] || fail "commit-msg '$2': exit $rc, expected $1"; ok
}
msg 0 'ci(workflows): wire just + lefthook + mise'
msg 0 'feat!: drop the legacy endpoint'
msg 0 'feat(api)!: drop the v1 endpoint'
msg 0 'Merge branch main into feat/1'
msg 1 'Wire just'
msg 1 'ci(workflows): ends with a period.'
msg 1 'wip: not a listed type'
msg 1 'Feat: capitalised type'
msg 1 'feat:no space after the colon'
msg 1 ''
long=$(printf 'x%.0s' $(seq 1 94))
msg 0 "feat: $long"   # 100 characters
msg 1 "feat: ${long}x" # 101
rc=0; sh scripts/check-commit-msg.sh > /dev/null 2>&1 || rc=$?; [ "$rc" -eq 2 ] || fail "check-commit-msg without argument: exit $rc, expected 2"; ok

# L0 in a throwaway repository holding this repository's hook config and scripts. The eslint and
# prettier jobs need the workspace's node_modules: the throwaway repo gets a symlink to them.
repo="$work/repo"
mkdir -p "$repo" && cd "$repo"
git init -q -b main && git config user.email t@example.com && git config user.name t
cp -R "$root/scripts" "$root/lefthook.yml" "$root/justfile" "$root/typos.toml" "$root/mise.toml" "$root/mise.lock" \
  "$root/eslint.config.js" "$root/package.json" "$root/pnpm-workspace.yaml" .
ln -s "$root/node_modules" node_modules
export MISE_TRUSTED_CONFIG_PATHS="$repo"
git add -A && git commit -qm init --no-verify
mkdir notes

fast() { # fast <expected-exit> <label> [<text the output must hold>]
  rc=0; just fast > "$work/out" 2>&1 || rc=$?
  [ "$rc" -eq "$1" ] || { cat "$work/out"; fail "$2: exit $rc, expected $1"; }
  [ -z "${3:-}" ] || grep -qF "$3" "$work/out" || { cat "$work/out"; fail "$2: output lacks '$3'"; }
  ok
}

fast 0 "empty stage"

echo 'Plain notes.' > notes/a.txt && git add notes/a.txt
fast 0 "clean staged change"

printf 'export default {};\n' > vitest.config.ts && git add vitest.config.ts # ignored by eslint.config.js
fast 0 "staged file ESLint ignores"
git rm -q --cached vitest.config.ts

key="AKIA$(printf seed | sha256sum | cut -c1-16 | tr 'a-f0-9' 'A-FG-P')"
printf 'token %s\n' "$key" > notes/leak.txt && git add notes/leak.txt
fast 1 "staged secret refused" "leaks found"
git rm -q --cached notes/leak.txt

printf 't%sh notes\n' e > notes/b.txt && git add notes/b.txt
fast 1 "staged typo refused" "should be"
git rm -q --cached notes/b.txt

# The installed commit-msg hook, end to end (pre-commit runs too: the stage is clean).
mise x -- lefthook install > /dev/null 2>&1 || fail "lefthook install in the throwaway repo"
git commit -qm 'Wire just' > /dev/null 2>&1 && fail "commit-msg hook accepted a bad subject"; ok
git commit -qm 'test(notes): add a plain note' > /dev/null 2>&1 || fail "commit-msg hook refused a good subject"; ok

echo "test-local-ci: $n cases passed"
