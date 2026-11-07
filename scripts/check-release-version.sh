#!/bin/sh
# The release tag must equal the version of every published manifest (skill release-tag, npm-publish):
# `v0.8.0` needs `"version": "0.8.0"`, `v0.8.0-rc.1` needs `"version": "0.8.0-rc.1"`. Otherwise a stable
# tag publishes nothing (the version already exists) or a pre-release burns the stable number under
# the `rc` dist-tag. Run from the checked-out release commit by prod.yml and `just publish`.
#   sh scripts/check-release-version.sh <tag>
set -eu
[ $# -eq 1 ] || { echo "usage: check-release-version.sh <tag>" >&2; exit 2; }
want=${1#v}
rc=0
for m in packages/*/package.json; do
  grep -q '"private": *true' "$m" && continue
  got=$(sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' "$m" | head -1)
  [ "$got" = "$want" ] || { echo "check-release-version: $m is $got, tag says $want" >&2; rc=1; }
done
[ "$rc" -eq 0 ] && echo "check-release-version: $want in every published manifest"
exit $rc
