# Local review — feedback-widget (ci/163-local-ci-publish-only)

- Date: 2026-11-07
- Commit: 3aa57c9 (ca5c729 reviewed, fixes in 8ef102d, 87c5984 and 3aa57c9)
- Scope: branch diff origin/main...HEAD (#163) — `--push` mode
- Checks run: adversarial (Opus, 4 rounds) · design · docs · tests · security · correctness
- Verdict: ship (every Must fixed) · Must 0 open (9 fixed) · Should 0 open (13 fixed, 1 follow-up) · Nice 4 follow-ups

## Adversarial review (#236)

- Round 1 on `ca5c729`: Must 6 · Should 6 · Nice 5 · unverified 0 · Push gate: closed
- Round 2 on `8ef102d`: 6 fixed · 0 not fixed · 0 regressed · new Must 1 (Prettier on PROJECT_LOG.md) · Push gate: closed
- Round 3 on `87c5984`: 4 fixed · 0 regressed · new Must 1 (README Node badge ≥ 22 vs manifests ≥ 20) · Push gate: closed
- Round 4 on `3aa57c9`: 1 fixed · 0 not fixed · 0 regressed · new Must 0 · **Push gate: open**
- Hosted reviewers: none by design (private Free repository, no Copilot; this report stands in, CLAUDE.md)

## Pre-merge gate (head SHA 3aa57c9)

| Step        | Result                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 CI mirror | n/a — no `pull_request` workflow left; `prod.yml` rehearsed with act (`just rehearse`: classify ok on stable, prerelease, refused)                      |
| 1 Tests     | ✅ core + web vitest suites · ✅ test-local-ci 63 cases · ✅ test-attest 20 cases                                                                       |
| 2 Coverage  | tests core 97.56 % stmts / 95.45 % branches / 91.3 % funcs / 97.36 % lines · web 97.95 / 93.11 / 99.33 / 99.7 (floor 80) · docs 100 % (75/75, floor 90) |
| 3 SonarQube | ⏸ deferred to the pre-merge run (`--push`)                                                                                                              |
| 4 Secrets   | ✅ gitleaks clean (origin/main..HEAD and `--all`) · no tracked .env · diff read: a public SSH key and GHSA ids only                                     |
| 5 E2E/smoke | ⏸ deferred to the pre-merge run (`--push`); no runtime change in this diff                                                                              |

- Gate: `--push`: **pre-push green** — `mise x -- just check` passed from a clean env (25 s), SonarQube and step 5 deferred (never GREEN)

## 🔴 Must Have (all fixed in 8ef102d / 87c5984)

- `lefthook.yml:11` `[adversarial|security]` · ESLint exits 1 on a staged file it ignores (`*.config.ts`) · `--no-warn-ignored`, case in test-local-ci
- `justfile` `test` `[adversarial]` · the lockfile-drift check of `verify.sh` was dropped · `pnpm install --frozen-lockfile --offline || …` first
- `justfile` `publish` `[adversarial|design]` · no `.npmrc` for `NODE_AUTH_TOKEN`, 401 at the last step · temporary user config holding the placeholder, `NPM_CONFIG_USERCONFIG`; token named and time-boxed in `.github/publish.md`
- `justfile` `publish` `[security]` · `build && typecheck` does not stop under `sh -eu` · two lines
- `justfile` `setup` `[adversarial]` · pre-#163 clones keep `core.hooksPath=.githooks`, `lefthook install` refuses · `--reset-hooks-path` + CONTRIBUTING migration note
- `.github/branch-protection.md`, `sonar-project.properties:21`, `CONTRIBUTING.md` `[adversarial|docs]` · stale contexts `build-test/lint/Secret detection`, Copilot/Codex, `pnpm verify`, hosted gitleaks, `-rcN` · all name `gate`, `just gate`, the local tiers, `-rc.N`
- `.github/workflows/prod.yml:32` `[tests]` · `classify` regex tested only under Docker · bash harness in test-local-ci on 16 tag shapes
- `justfile` `nightly` `[adversarial|design]` · docs promised a nightly TruffleHog no timer ran · `feedback-widget-local-ci-nightly.{service,timer}` installed and enabled (04:20, Persistent)
- `PROJECT_LOG.md` `[adversarial, round 2]` · Prettier red · reformatted
- `README.md:3` `[adversarial, round 3]` · Node badge ≥ 22 against the published floor ≥ 20 · badge back to ≥ 20

## 🟡 Should Have (fixed unless marked)

- `prod.yml` `[adversarial|security]` · stable tags lost the ancestor-of-main check; nothing checked tag = manifest version · both channels require an ancestor of `main`; `scripts/check-release-version.sh` read from `main` (and by `just publish`)
- `justfile` `attest` `[design]` · the gated-main guard was lost with the `deploy` recipe · `attest.sh verify gate HEAD` first
- `osv-scanner.toml` `[security|design]` · package-wide waivers · 22 `[[IgnoredVulns]]` by GHSA id, `ignoreUntil` 2026-12-31, #164
- `prod.yml:76` `[design|security]` · pnpm floating `10` vs `10.30.3` · pinned, parity asserted in the test
- `prod.yml` `[security]` · base64 git header unmasked · `::add-mask::`
- `package.json` `[adversarial]` · Node 20 tested nowhere · root `engines >= 22`; the published manifests keep `>= 20` (round 2: consumer-visible otherwise)
- `README.md`, `CONTRIBUTING.md` `[adversarial|docs]` · clone section, L0/L1 wording, "branch is protected", history narration, TOC, PR template · rewritten
- `scripts/test-local-ci.sh` `[tests]` · bare greps, missing 100-character case, developer git config and mise trust list leaking · anchored greps, commit-msg edge cases, `GIT_CONFIG_GLOBAL=/dev/null`, `MISE_TRUSTED_CONFIG_PATHS`
- `scripts/test-attest.sh` `[tests]` · fake `gh` ignores the POST arguments and the jq filter; forgery setup unchecked; `bad signature` branch untested · **follow-up** in agents-skills (the file is a copy of `~/.claude/scripts/test-attest.sh`)
- `prod.yml` pre-release path `[design]` · `verify-tag` + ancestor inline, no test seam · **follow-up**: `attest.sh prerelease <tag>` upstream

## 🔵 Nice to Have (follow-ups)

- `scripts/check-commit-msg.sh:20` `[adversarial]` · `${#subject}` counts bytes under dash · upstream copy
- `justfile` `security` `[adversarial]` · Semgrep `p/default` unpinned · pin a ruleset version upstream in skill `semgrep-sast`
- `~/.config/systemd/user/feedback-widget-local-ci-nightly.*` `[adversarial]` · not versioned in `~/.claude/scripts/systemd/` · `~/.claude` chat
- `prod.yml` `[adversarial]` · alpha and beta share the `rc` dist-tag · pre-existing, skill `npm-publish`

## ⚪ Disagree / Intentional

- `prod.yml` `[security]` · a `v*` tag pusher can push a commit whose `prod.yml` skips the verification: only a tag ruleset closes it, unavailable on a private Free repository · recorded in `.github/tag-protection.md`; closes with the move to public (ADR-0005)
- `prod.yml` `[security]` · pre-releases publish without the gate status or staging note · skill `release-tag` template
- `lefthook.yml` vs `justfile` lint tools twice · designed split L0 staged / L1 whole repo (skill `local-ci`)
- `scripts/attest.sh`, `scripts/check-commit-msg.sh` vendored · `prod.yml` must read `main`'s copy
- `.github/allowed_signers` holds the owner's email and public key · ADR-0003 principal, no secret

## Per-dimension summary

- Adversarial: 6 Must + 6 Should + 5 Nice in round 1, 1 new Must in round 2, all closed · Design: 1 Must (fallback `.npmrc`), guards and pins restored · Docs: 3 Must stale statements fixed, anchors all resolve · Tests: `classify` and the hooks now run for real, 63 cases · Security: least privilege, masked header, token scoped to one step, waivers per advisory · Correctness: `&&` under `sh -eu`, lockfile drift, hooksPath migration
