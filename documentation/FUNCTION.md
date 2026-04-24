# Functional Status — Cross-system Compatibility

How HDS `function-*` items map to external systems and clinical terminologies.

The `function` domain captures the clinical construct of **functional status** — the patient's ability to perform key life activities. It is distinct from:

- **`body-*`** — physiological measurements (weight, temperature, …).
- **`symptom-*`** — symptom observations (pain, nausea, …).
- **`wellbeing-*`** — subjective psychological / behavioural self-reports (mood, mental distress, self-rated health).

Functional status aligns with the **International Classification of Functioning, Disability and Health (ICF)** published by the WHO, specifically the "Activities and Participation" component.

## Items

| HDS item | ICF code(s) | Construct |
|----------|-------------|-----------|
| `function-mobility` | `d450` Walking | Walking / lower-limb functional severity |
| `function-self-care` | `d510` Washing oneself, `d540` Dressing | Personal-care activities (ADL) |
| `function-usual-activities` | `d630`/`d640` Household tasks, `d845`–`d859` Work and employment, `d920` Recreation and leisure | Role / participation across life domains |

All three use the canonical 5-level severity scale on `ratio/proportion` — hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`. See `DESIGN-NOTES.md` → "Scale hook placement" for the governing rule, and `SYMPTOMS.md` → "Severity mapping" for the parallel rule in symptoms.

## External systems

### ICF qualifier (WHO) — the primary reference

The ICF `Generic Qualifier` scale is a 5-level severity applicable to every ICF code:

| ICF qualifier | HDS ratio value | HDS label |
|---|---|---|
| 0 NO problem | 0.0 | No problems |
| 1 MILD problem | 0.25 | Slight problems |
| 2 MODERATE problem | 0.5 | Moderate problems |
| 3 SEVERE problem | 0.75 | Severe problems |
| 4 COMPLETE problem | 1.0 | Unable |

**This is the canonical axis.** WHODAS 2.0, EQ-5D-5L, and PROMIS Physical Function all derive their 5-level Likert scales from this ICF qualifier.

### WHODAS 2.0 (WHO Disability Assessment Schedule)

Six domains × 5-level Likert — direct structural match. Each WHODAS domain maps to one or more HDS `function-*` items:

| WHODAS domain | HDS item(s) |
|---|---|
| Cognition | *(not yet modelled — candidate for `function-cognition`)* |
| Mobility | `function-mobility` |
| Self-care | `function-self-care` |
| Getting along | *(not yet modelled)* |
| Life activities | `function-usual-activities` (household + work sub-facets can be split later) |
| Participation | `function-usual-activities` |

### EQ-5D-5L dimensions 1–3

Plan 44 introduces these items to serve EQ-5D-5L D1 (Mobility), D2 (Self-care), D3 (Usual activities). The EuroQol wording ("I have no problems walking" etc.) is carried at the form-template level via `itemCustomizations.labels` in `doctor-dashboard`'s preset — **not** in the item definition, preserving item reusability across other PROs.

### PROMIS Physical Function / Social Roles Short Forms

PROMIS SF 4a uses a 5-level Likert ("Unable / With much difficulty / With some difficulty / With a little difficulty / Without any difficulty"). Maps directly to the same 0..1 hooks after inversion (the PROMIS scale runs in the opposite direction — "no difficulty" is the positive anchor). Bridges doing PROMIS ingestion should map by label to the HDS hook, not by ordinal position.

### SF-36 Physical Functioning (PF)

SF-36 PF uses a 3-level per-item Likert ("Limited a lot / Limited a little / Not limited at all") across 10 questions, summed into a subscale. The per-item 3-level scale collapses to HDS hooks `1.0 / 0.5 / 0.0` respectively. Per-item storage is useful if captured natively; SF-36 forms typically ship the total subscore separately.

### Katz ADL / Barthel Index

These classical ADL scales use binary or 2–4 level per-item responses and sum to a total score. Per-item responses for bathing / dressing / continence / transferring / toileting / feeding map to `function-self-care` (split further only when clinically meaningful). Totals are derived — recipients compute them from the per-item events.

### SNOMED CT

- `301438001` Able to walk (finding)
- `228127002` Mobility finding
- `284774004` Self-care finding
- `413156007` Activities of daily living finding

Finer-grained SNOMED concepts (unable to walk, uses walker, needs assistance for bathing, etc.) can be attached as additional references on more specific items if the domain is extended.

### FHIR

- `Observation` with `category = survey` and a `code` pointing to the relevant LOINC / SNOMED code.
- For multi-item instrument captures (PROMIS SF 4a, WHODAS, SF-36), a `QuestionnaireResponse` wraps the individual answers; the per-item `function-*` events are the underlying HDS storage.

## Design decisions

### 2026-04-24 — Plan 44

1. **New top-level `function/` domain.** Distinct from `symptom-*` (sensation), `wellbeing-*` (psychological / subjective), and `body-*` (physiological). Mirrors the ICF "Activities and Participation" component.
2. **Three items at launch.** `function-mobility`, `function-self-care`, `function-usual-activities` — matches EQ-5D-5L D1–D3 directly and covers the most widely-used PROMIS / SF-36 / WHODAS / Katz / Barthel subscales. Future extensions (cognition, communication, stair-climbing, fine motor, etc.) add sibling items as real use cases land.
3. **Shared severity scale.** 5-level `ratio/proportion` hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`. Matches the severity family across `symptom-pain-severity`, `wellbeing-mental-distress*`, and the ICF qualifier. One scale, one reader, one converter.
4. **Generic wording in the item.** "No problems / Slight / Moderate / Severe / Unable" at the item level; instrument-specific phrasings (EuroQol's first-person sentences, WHODAS's frequency framing, etc.) live at the form-template level via the label-override mechanism in `hds-forms-js`.

## Open extensions (future items, not in this plan)

- `function-cognition` — cognitive functioning severity (matches WHODAS Cognition, SF-36 Role-Emotional subset, ICF `d1*`).
- `function-communication` — speaking / understanding (ICF `d3*`).
- `function-stair-climbing` — stair-specific mobility sub-facet.
- `function-fine-motor` — manipulation / dexterity (ICF `d440`).
- `function-transferring` — bed-to-chair transfers (Katz item, Barthel component).

Add when a concrete use case (PRO, bridge, clinical form) needs it. No speculative additions.
