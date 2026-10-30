# Feedback taxonomy — families, sub-families and guided prompts

Source of truth for the category table the widget offers and the Worker validates (issue #128). `packages/core/src/domain/Feedback.ts` and the Worker allowlist conform to this document; the array order below is the on-screen order.

## D1 — Six families, every one with an `other` escape

| Family       | Label (fr / en)                                                         | Sub-families (`other` always last)                                            |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `bug`        | Ça ne marche pas / Something is broken                                  | `no-effect`, `crash`, `form-rejected`, `wrong-data`, `personal-data`, `other` |
| `display`    | C'est mal affiché / It looks wrong                                      | `broken-layout`, `mobile`, `missing-media`, `too-slow`, `other`               |
| `content`    | Erreur dans le contenu / Wrong content                                  | `typo`, `wrong-info`, `outdated`, `dead-link`, `other`                        |
| `unclear`    | Je n'ai pas compris ou j'ai une question / I didn't understand or I ask | `wording`, `missing-info`, `navigation`, `question`, `other`                  |
| `suggestion` | J'ai une idée / I have an idea                                          | `new-feature`, `improvement`, `design`, `accessibility`, `other`              |
| `praise`     | J'aime bien / I like it                                                 | none (free text, `subCategory = null`)                                        |

6 families, 26 sub-families (was 5 / 13). User-visible changes besides the additions: `display` is the second tile, `bug` starts with `no-effect` (was `crash`), and the `unclear` label gains "ou j'ai une question". The `dead-link` label becomes "Lien mort ou mauvais lien" (key unchanged).

Rationale: production data (2026-10-30, 16 rows) is 75 % `suggestion/improvement` + `unclear/missing-info` and 0 % `bug` / `content` — testers file defects as "improvement" for lack of a precise slot, and no `other` exists since #84. QA taxonomies (uTest, BrowserStack, testRigor) separate functional from visual defects, hence `display`.

## D2 — Two moves, kept alive by a Worker compatibility window

| Widget ≤ 0.6 sends   | Stored as (≥ 0.7)       |
| -------------------- | ----------------------- |
| `bug/broken-display` | `display/broken-layout` |
| `bug/too-slow`       | `display/too-slow`      |

Everything else is additive; `content/dead-link` and `suggestion/accessibility` keep their keys. Because deployed widgets keep sending the old pairs (and the #84 legacy chain still maps `bug/visual-glitch` and `error/missing-asset` onto `bug/broken-display`), the Worker **accepts both and remaps at ingest**, exactly as #84 did:

1. Worker first (Worker-breaking change, CLAUDE.md § Repo-specific traps): extend the allowlist with the new values, add the two 0.6 → 0.7 entries to the legacy remap, retarget the two #84 entries above to `display/broken-layout`, ship migration `0003` rewriting any stored `bug/broken-display` and `bug/too-slow` rows (0 today).
2. Widget 0.7 release + bundle refresh.
3. One tracked issue closes the window once every pinned consumer runs widget ≥ 0.7 (same pattern as #102).

Hosts that pass an explicit `WidgetConfig.categories` list must add `display`, or their reporters lose every visual-defect slot: CHANGELOG migration note.

## D3 — `personal-data` is flagged by the Worker

`bug/personal-data` (someone else's data visible, suspicious content) is rare and does not earn a tile; the Worker derives a priority flag from the key at ingest. The payload shape is unchanged and the widget domain knows nothing about the flag.

## D4 — Guided prompt per family/sub-family pair (view layer only)

Screen ⑤ shows a question and a placeholder. They live in `packages/web/src/i18n.ts` as `precision.prompts: Partial<Record<CategoryPair, Prompt>>` plus one `defaultPrompt`, never in the domain. `CategoryPair` is derived from `SUB_CATEGORIES_BY_CATEGORY` (a mapped type over each family's own sub-families, so `praise/crash` cannot be written). Lookup order: the pair, then the family fallback (`suggestion`, `praise`), then `defaultPrompt`. The pair key is required because `other` exists in five families.

| Pair                                      | Question (fr)                                   | Placeholder (fr)                         |
| ----------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `bug/no-effect`                           | Qu'as-tu essayé de faire ?                      | J'ai cliqué sur … et rien ne s'est passé |
| `bug/crash`                               | Que faisais-tu juste avant ?                    | La page s'est figée quand …              |
| `bug/form-rejected`                       | Quel champ est refusé, avec quelle valeur ?     | Le champ … refuse …                      |
| `bug/wrong-data`                          | Qu'est-ce qui est affiché, et qu'attendais-tu ? | Il affiche … alors que …                 |
| `bug/personal-data`                       | Qu'as-tu vu qui ne devrait pas l'être ?         | Je vois …                                |
| `display/broken-layout`                   | Qu'est-ce qui déborde ou se chevauche ?         | Le bouton … passe sous …                 |
| `display/mobile`                          | Que se passe-t-il sur ton appareil ?            | Sur mon téléphone, …                     |
| `display/missing-media`                   | Quelle image ou vidéo manque ?                  | L'image de … ne s'affiche pas            |
| `display/too-slow`                        | Quelle action est lente ?                       | Le chargement de … prend …               |
| `content/typo`                            | Recopie la faute.                               | « … » devrait être « … »                 |
| `content/wrong-info`, `content/outdated`  | Qu'est-ce qui est faux ou dépassé ?             | Il est écrit … mais …                    |
| `content/dead-link`                       | Où mène le lien, et où devrait-il mener ?       | Le lien « … » mène à …                   |
| `unclear/wording`, `unclear/missing-info` | Qu'aurais-tu voulu lire ?                       | Je m'attendais à trouver …               |
| `unclear/navigation`                      | Que cherchais-tu ?                              | Je cherchais … et je n'ai pas trouvé     |
| `unclear/question`                        | Pose ta question.                               | Comment … ?                              |
| fallback `suggestion`                     | Décris ton idée.                                | Ce serait bien de …                      |
| fallback `praise`                         | Qu'est-ce qui t'a plu ?                         | J'ai aimé …                              |
| `defaultPrompt` (covers `*/other`)        | Explique-nous.                                  | (empty)                                  |

## D5 — Navigation keeps the draft

- `back` from ④ or ⑤ keeps `userMessage` and `reporterName`; only `selectedSubCategory` is cleared when returning to ③, so a stale sub-family cannot outlive a family change.
- `close` / `Escape` from ③, ④, ⑤ or the error step with a non-blank `userMessage` moves to the new step `discard-confirm` instead of resetting; two new `UserAction` kinds, `keep-editing` (returns to the step left) and `discard` (reset). `close` inside `discard-confirm` is ignored.
- `close` during `sending` is ignored: today the controller resets while `handleSubmit` keeps running, and the late result re-opens the widget (bug found during review, fixed in the same change).
- ④ and ⑤ show a clickable breadcrumb `family › sub-family`.

Diagrams: [`../diagrams/feedback-taxonomy/04-class.md`](../diagrams/feedback-taxonomy/04-class.md), [`../diagrams/feedback-taxonomy/05-state-widget-session.md`](../diagrams/feedback-taxonomy/05-state-widget-session.md).
