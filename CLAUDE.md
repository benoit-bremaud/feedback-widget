# CLAUDE.md — feedback-widget

> **Cross-agent global rules**: inherit from `~/.agent-rules/common.md` (Q&A
> pattern with weighted scoring, pre-push review gate, conception gate, PR-review
> Q&A method, environment tiers) and `~/.claude/CLAUDE.md` (Claude Code
> specifics). Those files are the source of truth; this one only holds what is
> **specific to this repo**. Contribution conventions (issues, branches, commits,
> PR metadata, DoD, release, tags) live in [CONTRIBUTING.md](CONTRIBUTING.md).

## What this repo is

pnpm workspace, two packages, hexagonal split:

- `packages/core` — DOM-free domain + ports + use-cases + config. Never imports
  `packages/web` or any browser API.
- `packages/web` — browser adapters + the single public entry point
  `mountFeedbackWidget`. Ships a self-contained bundle (`dist-bundle/`).

The widget is the **client side of a multi-project feedback pipeline**. The
server side lives in the separate repo `feedback-pipeline-worker` (Cloudflare
Worker + D1). Specs and UML for the whole pipeline are kept **here**, under
`docs/architecture/` (`specs/` + `diagrams/<feature>/`).

## Commands

| Command                                                      | What                                                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                                                | Local gate: format → lint → gitleaks → build → typecheck → tests+coverage → SonarQube. Runs on `git push` via `.githooks/pre-push`. |
| `pnpm build` / `pnpm typecheck` / `pnpm test`                | Per-package via `pnpm -r`.                                                                                                          |
| `pnpm test:coverage`                                         | Thresholds enforced (see CONTRIBUTING § Coverage).                                                                                  |
| `pnpm lint` / `pnpm format:check`                            | Zero-warning policy; Prettier owns formatting.                                                                                      |
| `pnpm sonar`                                                 | Local SonarQube at `http://localhost:9000`, needs `SONAR_TOKEN` exported. Never paste that token anywhere.                          |
| `pnpm --filter @benoit-bremaud/feedback-widget build:bundle` | Emits `feedback-widget.js` + `widget-X.Y.Z.js`.                                                                                     |

## Three gates before any push

Conception (skill `uml-diagram-new`) → pre-push review (skill `review-local`,
then `pnpm verify`) → PR review (skill `pr-review-procedure`). No hosted
reviewer (no Copilot / Codex credits): the `review-local` report on the PR
head stands in for the automated review in the merge gate. `pnpm verify`
fails on a missing scanner unless `VERIFY_ALLOW_SKIP=1`. Procedure:
[CONTRIBUTING § Working method](CONTRIBUTING.md#working-method--the-three-gates).

## Repo-specific traps

- **Worker contract coupling.** `feedback-pipeline-worker` re-implements the
  payload shape, the category → sub-category tables and the bounds. Changing
  any of these is a **Worker-breaking change**: flag it in the PR and ship the
  Worker first. Where they live: payload + category tables in
  `packages/core/src/domain/Feedback.ts`; `MIN_/MAX_MESSAGE_LENGTH` (10–2000) in
  `packages/core/src/config/WidgetConfig.ts`; the reporter-name limit (50) only
  as `maxlength` in `packages/web/src/adapters/WebComponentView.ts`.
- **Every widget release needs a bundle refresh in the Worker repo**
  (`public/widget.js` + `public/widget-X.Y.Z.js`).
- **`main` is not branch-protected** (free plan, private repo). The pre-push
  hook is the last barrier. Always `git branch --show-current` before commit.
- `CHANGELOG.md` = published versions only. `PROJECT_LOG.md` = operational
  journal; bundle the entry for the previous PR into the next substantive PR.
- No SonarCloud and no CodeQL (private repo, free plan): static analysis is
  the local SonarQube step of `pnpm verify`.

## GitHub metadata

- Project board: `feedback-widget`, number 52, node `PVT_kwHOB8rwIc4BVJlN`.
  Every issue and PR is added to it with a Status.
- Labels: `type:*` + `area:*` + `prio:*` triptych, plus `epic`, `security`,
  `tech-debt`, `next:N`. Full PR metadata: CONTRIBUTING § Pull Request metadata.

## Code rules that only apply here

- Shadow DOM rendering goes through the single `innerHTML` in
  `WebComponentView.renderInternal`; **every user-provided string passes
  through `escapeHtml`**. Host-provided strings (config, i18n) are trusted.
- Storage is namespaced per `projectId`; the outbox persists **full payloads**
  (50 entries, 7 days, see SECURITY.md); outbox and rate limiter are bounded
  and degrade silently when `localStorage` is unavailable.
- Messages are i18n'd via `packages/web/src/i18n.ts` (`fr` / `en`): no
  hardcoded UI strings in views.
