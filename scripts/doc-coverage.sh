#!/usr/bin/env bash
# Documentation coverage of exported declarations (skill documentation-coverage).
#
# Counts top-level `export` declarations in packages/*/src (tests excluded) and
# how many have a `/** */` block right above them. Bare re-exports
# (`export { … }`, `export type { … }`, `export *`) and `typeof` companion
# types are not counted: they carry no contract of their own.
#
# Usage: ./scripts/doc-coverage.sh [floor-percent]   (default 90)
#        Prints undocumented exports, then the figure; exits 1 below the floor.
set -euo pipefail

cd "$(dirname "$0")/.."
floor="${1:-90}"

git ls-files 'packages/*/src/*.ts' 'packages/*/src/**/*.ts' \
  | grep -v '\.test\.ts$' \
  | xargs -r awk -v floor="$floor" '
      FNR == 1 { prev = "" }
      /^export / {
        if ($0 ~ /^export (type )?(\{|\*)/) next
        if ($0 ~ /^export type [A-Za-z]+ =.*\(typeof /) next
        total++
        if (prev ~ /\*\/[ \t]*$/) documented++
        else print "  undocumented: " FILENAME ":" FNR "  " $0
      }
      $0 !~ /^[ \t]*$/ { prev = $0 }
      END {
        pct = total ? int(documented * 100 / total) : 100
        printf "Doc coverage: %d/%d exported declarations (%d%%, floor %d%%)\n", documented, total, pct, floor
        exit pct < floor
      }'
