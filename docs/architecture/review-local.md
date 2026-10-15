# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-15
- Commit: 3b638d6 (after fixes; reviewed at 0b69cdf)
- Scope: `git diff origin/main...HEAD` — 3 files: root `package.json` version, CONTRIBUTING § Release workflow (steps 6–7, bump rule, hotfix), PROJECT_LOG (#90 SHA, v0.6.0 release entry)
- Checks run: docs · correctness (design · tests · security assessed inline as not applicable: no code, no dependency, no workflow change)
- Verdict: ship · Must 0 · Should 1 · Nice 3 — all resolved in-branch

## 🔴 Must Have

_None._

## 🟡 Should Have

- commit message / `PROJECT_LOG.md:1137` `[correctness|docs]` · "Closes #13" overclaimed: #13's DoD asks for a hotfix procedure and who/when notifies consumers, neither present · **Fixed**: step 7 (notify consumers), version bump rule and hotfix paragraph added to CONTRIBUTING § Release workflow; log sentence aligned.

## 🔵 Nice to Have

- `CONTRIBUTING.md:844-846` `[correctness]` · "Skip (a) … the bundle copy is still needed" contradicted itself since (a) includes the copy · **Fixed**: Worker code update conditional, bundle copy + deploy on every release.
- `PROJECT_LOG.md:1129` `[docs]` · heading did not lead with the PR like its neighbours · **Fixed**.
- `PROJECT_LOG.md:1143-1145` `[docs]` · Ref line layout (issue first, commas) · **Fixed**.

## ⚪ Disagree / Intentional

- `PROJECT_LOG.md:1136` `[correctness]` · entry describes the CONTRIBUTING change carried by the same PR · Intentional per the log cadence rule (entry bundled into the next substantive PR).

## Per-dimension summary

- Design: n/a (docs + version string) · Docs: SHAs, tag, headings and links all verified; one overclaim fixed · Tests: n/a; `pnpm verify` green (68 + 134) · Security: n/a; root version read by nothing, lockfile untouched · Correctness: ordered list valid, link targets resolve, `Closes #82` legitimate.
