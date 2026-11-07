<!--
Thank you for opening a PR.

This is the auto-loaded runtime PR template. It mirrors the canonical
contribution policy documented in CONTRIBUTING.md — CONTRIBUTING.md is
the source of truth; this file enforces the format at PR-open time.
Keep the sections below. Delete any section that does not apply (for
example, drop "Tests" on a docs-only PR). Finish with `Closes #<issue>`.

Full contribution rules: https://github.com/benoit-bremaud/feedback-widget/blob/main/CONTRIBUTING.md
-->

## Summary

<!-- One or two sentences — what the PR does and why, written for a human reviewer. -->

### <Area — e.g. Core / Web / CI / Governance / Docs>

- <Key change>
- <Key change>

<!-- Repeat the `### <Area>` block per package/area touched. -->

## Tests

| Package                   | New tests       | Total      |
| ------------------------- | --------------- | ---------- |
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
- [ ] No secrets committed (`just secrets` clean)
- [ ] `just check` green; `just gate` green and attested on the head SHA before the merge
- [ ] Sidebar metadata populated: assignees, reviewers, labels triptych (`type:*` + `area:*` + `prio:*`), project `feedback-widget`, milestone inherited from the linked issue

Closes #<issue-number>
