# Lifestyle — scope, coded vocabularies and external mapping

How HDS `lifestyle-*` items map to external systems and clinical terminologies.

The `lifestyle` domain captures **health-related behaviours**: tobacco, alcohol and diet. It corresponds
to what FHIR files under the `social-history` observation category and what a clinician would call social
history. It is distinct from:

- **`nutrition-*`** — nutritional state and intake sensation (`nutrition-appetite`). *What the body reports*, not what the person chooses to eat.
- **`activity-*`** — physical activity and exercise sessions.
- **`condition-*`** — established diagnoses. Alcohol-use disorder is a condition; drinking frequency is not.
- **`profile-*`** — durable demographic identity.

`lifestyle` is a new top-level stream rather than a child of an existing parent. `AGENTS.md` §4 prefers a
child under an existing parent, and that preference was weighed: tobacco and alcohol have no plausible
existing parent, and splitting diet away from them (under `nutrition`) would scatter one screener across
two roots for an app reading a social history.

## Items

| HDS item | eventType | SNOMED (item) | Construct |
|---|---|---|---|
| `lifestyle-tobacco-smoking` | `lifestyle/use-status-v1` | `365981007` Finding of tobacco smoking behavior | Smoking status |
| `lifestyle-tobacco-ecigarette` | `lifestyle/use-status-v1` | `722499006` Electronic cigarette user | Vaping status |
| `lifestyle-tobacco-smokeless` | `lifestyle/use-status-v1` | `713914004` User of smokeless tobacco | Smokeless tobacco status |
| `lifestyle-alcohol-frequency` | `lifestyle/frequency-band-v1` | `228273003` Finding relating to alcohol drinking behavior | AUDIT-C Q1 |
| `lifestyle-alcohol-typical-quantity` | `mass/g` (legacy) | `896810008` Estimated quantity of intake of ethanol in grams in 24 hours | AUDIT-C Q2 |
| `lifestyle-alcohol-binge-frequency` | `lifestyle/frequency-band-v1` | `228326007` Drinking binge | AUDIT-C Q3 |
| `lifestyle-diet-pattern` | `lifestyle/diet-pattern-v1` | `364828006` Finding of diet followed | Overall dietary pattern |
| `lifestyle-diet-restriction` | `lifestyle/diet-restriction-v1` | `364828006` Finding of diet followed | Foods avoided |

Every SCTID above and below was verified **active** against a SNOMED CT International release using
`reference/snomed-db` (`npx tsx src/cli.ts verify <id>`). Several obvious candidates are **inactive** and
were rejected on that basis: `5940000` Vegetarian diet, `24930006` Vegan, `6468003` Gluten free diet,
`47059008` Sodium restricted diet, `284731009` Omnivore, `137982008` / `160601007` Non-smoker,
`138009002` Ex-smoker, `160573003` Alcohol intake, `102266007` Kosher diet. Re-verify before adding any
code to this table.

## Option-level codes

`references` is item-level in this model — options carry no codes — so the per-option mapping lives here.
A consumer exporting to FHIR reads this table.

### Tobacco — `lifestyle/use-status-v1`

| value | SNOMED (smoking) | SNOMED (e-cigarette) |
|---|---|---|
| `never` | `266919005` Never smoked tobacco | `1137690000` Never used electronic cigarette |
| `former` | `8517006` Ex-smoker | `35361000087100` Ex-electronic cigarette user |
| `current` | `77176002` Smoker | `722499006` Electronic cigarette user |

Smokeless tobacco has `713914004` User of smokeless tobacco for `current`; SNOMED carries no equally
direct never/former pair, so those two export as the item code plus the status value.

The triad is a **coarsening** of the US Core `Smoking status` value set, mapped onto the three codes that
survive it. US Core splits current into `449868002` Smokes tobacco daily and `428041000124106` Occasional
tobacco smoker, adds heavy and light variants, and carries two unknown states (`266927001` Tobacco smoking
consumption unknown among them). None of those is modelled: they are frequency distinctions, and v1 stores
no tobacco frequency at all (see "What v1 does not store").

**Export caveat.** `current` maps to `77176002`, whose SNOMED FSN is "Smoker (finding)" but which US Core
displays as "Smoker, current status unknown". A US Core-aware reader will therefore read an HDS `current`
as *unknown frequency*. That is accurate here, since this item carries no frequency, but it is worth
knowing before writing an export.

### Diet pattern — `lifestyle/diet-pattern-v1`

| value | SNOMED |
|---|---|
| `omnivore` | `36823005` Normal diet (finding) |
| `pescatarian` | `1255166007` Pescovegetarian diet (regime/therapy) |
| `vegetarian` | `765021002` Vegetarian diet (regime/therapy) |
| `vegan` | `1255165006` Vegan diet (regime/therapy) |
| `other` | — |

### Diet restrictions — `lifestyle/diet-restriction-v1`

| value | SNOMED |
|---|---|
| `gluten-free` | `437651000124104` Gluten free diet (regime/therapy) |
| `lactose-free` | `425458000` Lactose-free diet (regime/therapy) |
| `nut-free` | `226200009` Nut-free diet (finding) — see the peanut caveat below |
| `low-sodium` | `386619000` Low sodium diet (finding) |
| `halal` | `1255164005` Halal diet (regime/therapy) |
| `kosher` | `765025006` Kosher diet (regime/therapy) |
| `other` | — |

SNOMED mixes `(finding)` and `(regime/therapy)` hierarchies across these concepts, and no single
hierarchy covers the whole set. The active concept closest in meaning was chosen per option rather than
forcing one hierarchy and using an inactive or approximate code.

**`nut-free` includes peanuts, and both labels say so.** EU allergen labelling and the French "fruits à
coque" **exclude** peanuts, which are a separate allergen (arachides), while English "nut-free" is
commonly read to include them. For a restriction that may be recorded by medical need, that divergence is
not cosmetic. A later split into `tree-nut-free` and `peanut-free` is additive and can wait.

**`omnivore` exports to `36823005` "Normal diet"**, which is a no-special-diet finding rather than a
positive statement of an omnivorous pattern. It is the closest active concept; "normal" is SNOMED's
wording, not a judgement this model makes about the other patterns.

## AUDIT-C

The three alcohol items are the AUDIT-C screener (Bush et al., 1998), the 3-question short form of the
WHO AUDIT. They map one item per question.

**Bands are stored, not scores.** The model does place numeric hooks on ordinal scales elsewhere (EQ-5D
sits on `ratio/proportion` at 0 / 0.25 / 0.5 / 0.75 / 1.0), so the reason here is not simply that bands are
ranges. It is that `ratio/proportion` is the *severity and intensity* interop surface, where 0 is none, 1
is maximum, and cross-scale readers may match by closest value. A drinking-frequency band has no "maximum"
anchor to normalise against, and must not be closest-value-matched against frequency scales from other
instruments. So the bands are stored as codes.

The 0–4 per-question score and the 0–12 total are **derived on the reader side**, the same convention this
model applies to every other derived value. The scoring is positional: the first option scores 0 and each
subsequent option scores one more.

| | Q1 `lifestyle-alcohol-frequency` | Q3 `lifestyle-alcohol-binge-frequency` |
|---|---|---|
| 0 | `never` | `never` |
| 1 | `monthly-or-less` | `less-than-monthly` |
| 2 | `2-4-per-month` | `monthly` |
| 3 | `2-3-per-week` | `weekly` |
| 4 | `4-plus-per-week` | `daily-or-almost-daily` |

**Q1 and Q3 share one eventType, `lifestyle/frequency-band-v1`.** It declares the union of the bands, and
each item selects its own five. The loader checks that every item option is present in the enum and does
*not* require an item to cover it, so the subset is the item-level constraint `AGENTS.md` prefers over a
new type. `streamId` is what distinguishes the two questions, per the storage identity rule. The union
also gives future habitual-frequency items a home without another eventType each.

**Q2 is stored in grams of ethanol, not standard drinks.** A standard drink is 8 g in the UK (one unit,
10 mL of ethanol), 10 g in Australia and France, and 14 g in the US, so a stored drink count cannot be
compared across cohorts without knowing where it was entered. The app converts from the local standard drink at entry. AUDIT-C's own Q2 scoring
bands are in drinks (1–2, 3–4, 5–6, 7–9, 10+), so a reader computing the score converts back using its
own jurisdiction's definition — an explicit, auditable step rather than a silent assumption.

`lifestyle-alcohol-typical-quantity` reuses the **legacy Pryv `mass/g`**. A lifestyle-scoped grams type
would be numerically identical to it, which is the equivalent-twin hazard `AGENTS.md` forbids
non-negotiably: identical values would land under two type names and split the same measurement into two
populations.

**Lower bound.** `mass/g` itself declares no minimum, so the item declares `min: 0` at its root (the
`type: number` branch of the item schema carries `min` / `max` / `step` as item properties, alongside the
`number.display` block). The model publishes it. Renderers should enforce it, and `hds-forms-js` does not
yet — `NumberInput.tsx` ignores the field — so a reader should still treat a negative grams-of-ethanol
value as invalid.

## What v1 does not store, and why

- **Tobacco quantity** — cigarettes per day does not generalise to the e-cigarette and smokeless
  siblings, and pack-years is derived from it, which belongs on the reader side. Adding a quantity item
  later is additive; shipping the wrong unit is not reversible.
- **Dietary intake frequency** — this is where a food-frequency questionnaire begins. `AGENTS.md` §4 puts
  a questionnaire's identity in the form template, not in stream structure.
- **Unknown / declined answers** — these are not options on any item here. Per `AGENTS.md` §4 (plan 71),
  yes / no / unknown / declined semantics live entirely on `questionnaire/answer-v1`; per-domain
  assertion eventTypes were explicitly rejected.

## Stream shape

One leaf stream per item, under three group streams. Leaf streams are what D3 walk-up and authorizations
grant on, so a study can request drinking frequency without heavy-episode frequency, which is the more
sensitive of the two. This follows `body-blood-serum-*`, which is one stream per analyte for the same
reason.

```
lifestyle
├── lifestyle-tobacco
│   ├── lifestyle-tobacco-smoking
│   ├── lifestyle-tobacco-ecigarette
│   └── lifestyle-tobacco-smokeless
├── lifestyle-alcohol
│   ├── lifestyle-alcohol-frequency
│   ├── lifestyle-alcohol-typical-quantity
│   └── lifestyle-alcohol-binge-frequency
└── lifestyle-diet
    ├── lifestyle-diet-pattern
    └── lifestyle-diet-restriction
```

## Repeatability

Every item is `repeatable: any`. These are durable but changing facts, like
`profile-reproductive-stage`: a new dated entry is recorded whenever the answer changes, and the history
is the value. None is a daily observation, so none is `P1D`.
