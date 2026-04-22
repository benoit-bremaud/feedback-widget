<!--
Thank you for opening a PR.

This template is the single source of truth for PR structure in this repo.
Keep the sections below. Delete any section that does not apply (for
example, drop "Tests" on a docs-only PR). Finish with `Closes #<issue>`.

Full contribution rules: ../CONTRIBUTING.md
-->

## Summary

<!-- One or two sentences — what the PR does and why, written for a human reviewer. -->

### <Area — e.g. Core / Web / CI / Governance / Docs>

- <Key change>
- <Key change>

<!-- Repeat the `### <Area>` block per package/area touched. -->

## Tests

| Package | New tests | Total |
| --- | --- | --- |
| `core` (Vitest, node env) | N (description) | **X pass** |
| `web` (Vitest, happy-dom) | N (description) | **X pass** |

`tsc --noEmit` clean on all affected packages.

<!-- Docs-only PRs may drop the entire Tests section. -->

## Checklist

- [ ] Happy path + sad path + edge cases covered
- [ ] `tsc --noEmit` passes on all affected packages
- [ ] `pnpm -r build` passes
- [ ] All existing tests still green (`pnpm -r test`)
- [ ] No `any` TypeScript type introduced; no inline styles introduced (if touching `packages/web`)
- [ ] No secrets committed (Gitleaks clean)
- [ ] No AI attribution anywhere in this PR (commits, body, comments, diff)
- [ ] Sidebar metadata populated: assignees, reviewers, labels triptych (`type:*` + `area:*` + `prio:*`), project `feedback-widget`, milestone inherited from the linked issue

Closes #<issue-number>
