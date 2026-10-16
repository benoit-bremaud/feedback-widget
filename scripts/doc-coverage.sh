#!/usr/bin/env bash
# Documentation coverage of exported declarations (skill documentation-coverage).
#
# Counts top-level `export` declarations in packages/*/src (tests and .d.ts
# excluded) and how many have a `/** */` block right above them (a plain
# `/* */` or `//` comment does not count). Bare re-exports
# (`export { … }`, `export type { … }`, `export *`) and `typeof` companion
# types are not counted: they carry no contract of their own.
#
# Usage: ./scripts/doc-coverage.sh [floor-percent]   (default 90)
#        Prints undocumented exports, then the figure; exits 1 below the floor.
set -euo pipefail

cd "$(dirname "$0")/.."
floor="${1:-90}"

git ls-files 'packages/*/src/*.ts' 'packages/*/src/**/*.ts' \
  | grep -vE '\.(test|d)\.ts$' \
  | xargs -r awk -v floor="$floor" '
      FNR == 1 { injsdoc = 0; lastjsdoc = 0 }
      /^[ \t]*\/\*\*/ { injsdoc = 1 }
      /^export / {
        if ($0 ~ /^export (type )?(\{|\*)/) next
        if ($0 ~ /^export type [A-Za-z]+ =.*\(typeof /) next
        total++
        if (lastjsdoc) documented++
        else print "  undocumented: " FILENAME ":" FNR "  " $0
      }
      $0 !~ /^[ \t]*$/ {
        if (injsdoc) { lastjsdoc = ($0 ~ /\*\/[ \t]*$/); if (lastjsdoc) injsdoc = 0 } else lastjsdoc = 0
      }
      END {
        pct = total ? int(documented * 100 / total) : 100
        printf "Doc coverage: %d/%d exported declarations (%d%%, floor %d%%)\n", documented, total, pct, floor
        exit pct < floor
      }'
