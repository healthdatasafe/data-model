# Nutrition — nutritional state

What the `nutrition` domain covers, and the boundary that keeps it apart from `lifestyle-diet`.

## What exists

| item | eventType | type | repeatable | stream |
|---|---|---|---|---|
| `nutrition-appetite` | `ratio/proportion` | select | `P1D` | `nutrition-appetite` |

One item. This domain is deliberately small, and the boundary below is the reason it has not grown.

## The boundary: `nutrition` vs `lifestyle-diet`

This is the distinction most likely to be got wrong, because both sound like "food".

| | records | example |
|---|---|---|
| **`nutrition-*`** | the body's nutritional **state**, as the person experiences it | appetite today |
| **`lifestyle-diet-*`** | what the person **chooses** to eat, as a standing fact | vegetarian, gluten-free |

Appetite is something that happens to you and changes day to day, which is why `nutrition-appetite` is
`repeatable: P1D` — at most one entry per day. A dietary pattern is something you decide and hold for
months, which is why `lifestyle-diet-pattern` is `repeatable: any` and lives under `lifestyle`, the
health-related-behaviour domain. See [`LIFESTYLE.md`](LIFESTYLE.md).

The placement was considered explicitly when the lifestyle domain was added (plan 100, 3.10.0): diet
could have become `nutrition-diet` under this parent. It did not, because tobacco and alcohol have no
plausible existing parent and splitting diet away from them would scatter one social-history screener
across two roots.

## `nutrition-appetite`'s scale, and why it does not transfer

Three options on `ratio/proportion` at **0.25 / 0.50 / 0.75** — decreased, normal, increased.

The introducing commit records no rationale, so what follows is reconstruction, not a decision on file.
The placement is consistent with the `DESIGN-NOTES.md` → "Scale hook placement" rule that a midpoint
anchor sits at 0.5: "normal" is the anchor, and the two ends are symmetric departures from it. The 0.0 and
1.0 anchors go unused because the construct has no "none" and no "maximum" — unlike the 5-level severity
scales in `function-*` and `symptom-*`, which run the full 0.0 to 1.0.

**This placement does not transfer to quantity or frequency constructs.** It was examined for the
lifestyle domain and rejected: tobacco and alcohol are quantity and frequency, which have no "normal"
midpoint to anchor on, so they use coded bands from established screeners instead.

## Deliberately not modelled

- **Intake frequency / food-frequency questionnaires.** `AGENTS.md` §4 puts a questionnaire's identity in
  the form template, not in stream structure. A food-frequency instrument is built as a
  `CollectorRequest` over existing items, never as a `nutrition-*` sub-tree.
- **Macronutrient or calorie intake.** No item, and none proposed. Adding one would need a unit decision
  first, and the equivalence rule in `AGENTS.md` applies: check for a numerically identical legacy Pryv
  type before minting anything.
- **Weight.** That is `body-weight`, a physiological measurement, not a nutrition item.

## Encoding

No `references` block on `nutrition-appetite`. Appetite has usable SNOMED concepts, so this is a gap
rather than a decision — one instance of the model-wide encoding-coverage gap.
