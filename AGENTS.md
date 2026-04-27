# Agent primer — HDS data-model

This file orients future agents (Claude or others) working on the `data-model` repo. Read `README.md` for what the repo *is*; read this file for the **design principles and conventions** you need to hold in mind before adding or modifying items, streams, or eventTypes.

Always also read:
- `documentation/DESIGN-NOTES.md` — item design principles (now includes scale hook placement).
- `documentation/SYMPTOMS.md`, `MOOD.md`, `CERVICAL-POSITION.md`, `MENSTRUAL-CYCLE.md`, `PHYSICAL-ACTIVITY.md`, `SKIN.md` — per-domain design decisions and cross-system mappings.

---

## Core architectural principles

### 1. Items are the vocabulary — domain-named, source-agnostic, reusable

Every item (`body-weight`, `symptom-pain-headache`, `wellbeing-mood`, `nutrition-appetite`) is a **reusable clinical concept**. Item keys use kebab-case domain/body-system names — **never prefixed with an app, bridge, or questionnaire**.

- ✅ `function-mobility`, `symptom-pain-severity`, `wellbeing-mental-distress`
- ❌ `<bridge>-appetite`, `<pro>-mobility`, `<vendor>-pain`, `<questionnaire>-anxiety`

The same clinical concept should have **one** HDS item, regardless of which app / bridge / form / PRO introduced it. Creating questionnaire-prefixed or source-prefixed copies forks the vocabulary and makes cross-source analytics impossible.

### 2. One item = one `streamId` + one `eventType`

Enforced by the item loader (`src/items.js:103`). The pair `streamId:eventType` is the storage identity of an item and cannot collide across items.

Items may define `variations.eventType` (e.g. kg vs lb for body weight) — these are rendered as unit pickers, not as alternative items.

### 3. EventTypes describe **shape**, not questions

`ratio/proportion` (0..1), `activity/plain` (boolean presence with duration), `mass/kg`, `temperature/c`, `mood/5d-vectors`, `cervix-position/3d-vectors`. They describe units and JSON Schema shape — not clinical questions.

The same eventType is reused by many items. Adding a new eventType is rare and needs a clear reason.

### 4. Streams are a clinical-domain tree

`body-*`, `symptom-*`, `wellbeing-*`, `activity-*`, `fertility-*`, `nutrition-*`, `medication-*`, `profile-*`, `family-*`. Mirrors body systems / function domains, close to SNOMED CT and ICF categorisations.

**Do not create questionnaire-branded streams** (e.g. `questionnaire-eq5d5l`). Each data point lands in its clinical-domain stream; the questionnaire's identity lives in the *form template* (a `CollectorRequest` constructed via [hds-lib-js](https://github.com/healthdatasafe/hds-lib-js)'s `appTemplates.CollectorRequest` / `CollectorSection`), not in `data-model`.

### 5. Apps and health data live in different dimensions

App-contextual content (notes, chat, service messages) is declared in `definitions/appStreams.yaml` and attaches under each bridge's `{appStreamId}` at runtime. Health data — observations, measurements, PRO responses — lives in the main stream tree.

A bridge that captures health data (for example, a fertility-tracker bridge importing appetite → `nutrition-appetite`) does **not** get a copy of the item under its app stream. The appetite observation lands in `nutrition-appetite`, full stop.

### 6. Cross-method convertibility uses converter engines

When multiple observation methods measure the same underlying construct (e.g. 15 different cervical-fluid charting methods, multiple mood taxonomies), use `type: convertible` with a `converter-engine` block. Existing engines: `converters/cervical-fluid/`, `converters/mood/`. Both use a weighted N-dimensional vector space with Euclidean-distance matching.

This is not about questionnaires. It is about sources / methods of observation converging on a single normalized representation.

### 7. Wording lives in the item — form-level overrides are layered, not stored in data-model

`item.label`, `item.description`, and each `option.label` are the **canonical**, generic, reusable wording. They are rendered directly by readers and by [hds-forms-js](https://github.com/healthdatasafe/hds-forms-js) when no override is provided.

Form-specific wording (e.g. EuroQol's first-person sentences for EQ-5D-5L) lives in the **form template**, not in `data-model`. Templates carry per-itemKey overrides on the `CollectorRequest.sections[].itemCustomizations[itemKey].labels` bag (defined by [`appTemplates.ItemLabels`](https://github.com/healthdatasafe/hds-lib-js/blob/main/ts/appTemplates/itemLabels.ts) in hds-lib). Renderers prefer the override; in their absence they fall back to the item's canonical wording.

This means: do **not** add questionnaire-specific wording to items. Add the generic wording to items here, and have the form template override it for that questionnaire's licensed phrasing.

---

## The `ratio/*` scale hook placement rule

When an item uses `ratio/proportion` (or any `ratio/*` eventType) with discrete `select` options, hook values **must** be chosen to align with the semantic anchors of established competing scales — not by evenly distributing N points across [0, 1].

See `documentation/DESIGN-NOTES.md` → "Scale hook placement" for the full rule, canonical placements, and anti-patterns.

**Headline placements (memorise these):**

| Scale levels | Hooks | Covers |
|--------------|-------|--------|
| 5-level severity | `0.0 / 0.25 / 0.5 / 0.75 / 1.0` | EQ-5D-5L, PROMIS 5-level, VRS-5, ICF, WHODAS |
| 4-level severity | `0.0 / 0.25 / 0.5 / 1.0` *(subset of 5-level, no `0.75`)* | Apple HealthKit `HKCategoryValueSeverity` |
| 3-level absolute | `0.25 / 0.5 / 1.0` | Mild/Moderate/Severe intake screeners |
| 3-level relative | `0.25 / 0.5 / 0.75` | `wellbeing-sex-drive` (deviation from baseline, not absolute severity) |
| 11-level NRS | `0.0 / 0.1 / 0.2 / … / 1.0` | Pain NRS — every other hook aligns with 5-level |

**Anti-pattern: never use `0.0 / 0.33 / 0.66 / 1.0` for a 4-level scale.** "Moderate" belongs at `0.5`, not `0.66`.

---

## Items, eventTypes, streams — when to add what

### When adding a new **item**

1. Does the clinical concept already exist somewhere in `definitions/items/`? If yes, extend or reuse — do not duplicate.
2. Survey competing scales for the construct (PROMIS, ICF, SNOMED, LOINC, Apple HealthKit, FHIR questionnaires). Place your hooks at semantic anchors.
3. Pick the kebab-case domain key (`<stream>-<concept>`). No app / source / questionnaire prefixes.
4. Localise `label`, `description`, option `label`s with at minimum `{ en, fr }`.
5. Add SNOMED CT / LOINC / ICF / FHIR references — per the cross-system compatibility principle. Use the existing `hl7fhir:` block pattern for FHIR mapping (see `documentation/DESIGN-NOTES.md` body-weight example).
6. Place the item in the correct clinical-domain stream. Create a new child stream under an existing parent before creating a new top-level domain.
7. Run `npm run build` to verify validation passes.

### When adding a new **eventType**

**Default answer: don't.** Try hard to reuse an existing eventType with item-level constraints on options / hooks. The eventType registry is intentionally small.

Reasons to add one:
- A genuinely new **shape** (new JSON Schema structure) — e.g. multi-dimensional vector, composite object, new unit family.
- Existing types cannot encode the data without semantic distortion.

Reasons *not* to add one:
- "We want a different label" (labels belong on items/options, not eventTypes).
- "We want a different range" (ranges belong on items via option hooks or min/max constraints).
- "This questionnaire/app has its own concept" (the data still has a shape, and the shape is probably already defined).

### When adding a new **stream**

New streams are cheap; adding children under existing parents is cheaper still.

- New top-level stream → only for a genuinely new clinical domain (e.g. `function-*` for ICF Activities & Participation). Document its scope in a new `documentation/<DOMAIN>.md`.
- New child under existing parent → normal case. Match the hierarchy style (flat vs nested) of siblings.

---

## Reuse-first architecture — examples

### EQ-5D-5L (Plan 44)

The EQ-5D-5L questionnaire has 5 dimensions + a VAS. **None of them are EQ-5D-5L-specific:**

| EQ-5D-5L dimension | HDS item (reusable) | Clinical construct | Shared with |
|--------------------|---------------------|--------------------|-------------|
| Mobility | `function-mobility` | ICF `d450` walking function | WHODAS, SF-36 PF, PROMIS Physical Function, Barthel |
| Self-care | `function-self-care` | ICF `d510`/`d540` personal care | Katz ADL, Barthel, SF-36, WHODAS |
| Usual activities | `function-usual-activities` | ICF `d630`/`d845`/`d920` role/participation | SF-36 Role, PROMIS Social Roles, WHODAS |
| Pain/Discomfort | `symptom-pain-severity` | Overall pain intensity (VRS-5 / NRS) | PROMIS Pain Intensity, SF-36 BP, BPI, NRS |
| Anxiety/Depression | `wellbeing-mental-distress` | Summary distress severity | K6/K10, HADS-Total, PROMIS Emotional Distress |
| EQ VAS | `wellbeing-self-rated-health` | Self-rated health (SRH) | EQ VAS, SF-36 GH, PROMIS Global01, NHIS/MEPS |

The questionnaire's identity lives in the *form template* (a `CollectorRequest` built with [`appTemplates.CollectorRequest`](https://github.com/healthdatasafe/hds-lib-js) plus per-section `itemCustomizations.labels` for the EuroQol-licensed wording), not in the data model. When PROMIS Short Forms or SF-36 are added later, they reuse the same items via new templates.

### External-source bridges (general pattern)

A bridge that ingests health data from a third-party app or device maps its source observations to **generic** HDS items, not to bridge-prefixed copies. Typical mappings:

- Source's appetite / dietary observation → `nutrition-appetite`.
- Source's cervical-fluid observation → `body-vulva-mucus-inspect` (via the `cervical-fluid` converter, which normalises across charting methods).
- Source's mood / affect observation → `wellbeing-mood` (via the `mood` converter, which normalises across emotion vocabularies).

The bridge owns only its **app streams** (notes, chat, service messages) under its `{appStreamId}` — app-contextual content that has no HDS-native home. It does not own the health-data items themselves. See `definitions/appStreams.yaml`.

### Existing 5-level / 4-level scale interop

Apple HealthKit's 4-level `HKCategoryValueSeverity` maps as a **subset** of HDS 5-level:

```
HDS 5-level:   0.0 ─── 0.25 ─── 0.5 ─── 0.75 ─── 1.0
               None    Slight   Moderate  Severe   Very severe
Apple 4-level: 0.0 ─── 0.25 ─── 0.5 ─────────── 1.0
               NotPresent Mild   Moderate         Severe
                                                  (= Apple's ceiling)
```

Closest-value matching is correct for all 4 Apple values and 4 of 5 HDS values. Only HDS "Severe" (`0.75`) has no Apple equivalent — pick a tie-break direction (recommend upward to Apple Severe `1.0`) and document it in the bridge.

---

## Anti-patterns — do not

- **Do not** create questionnaire-prefixed or source-prefixed items (e.g. `<questionnaire>-mobility`, `<bridge>-appetite`, `<vendor>-pain`). See §1.
- **Do not** evenly distribute hook values for `ratio/*` selects (`0 / 0.33 / 0.66 / 1.0` for 4 levels). Use semantic-anchor placement.
- **Do not** rely on naive closest-value matching for cross-scale conversion at the event-type boundary. Use explicit **label-lookup** tables in bridges when the source scheme is known.
- **Do not** create "administration record" / "questionnaire envelope" eventTypes for grouping events from a single form filling. The events' shared `time` property is the grouping key. Derived scores (like EQ-5D state code, utility index) are recomputed on the reader side.
- **Do not** add a new eventType when item-level constraints on an existing type would do the job (see §"When adding a new eventType").
- **Do not** stream-nest by questionnaire. Data points belong in their clinical-domain streams.
- **Do not** bake questionnaire-specific wording (e.g. EuroQol's first-person sentences) into items. Items carry generic, reusable labels; form templates layer per-form overrides via `itemCustomizations.labels` (see §7).
- **Do not** create a new top-level stream when a child under an existing parent would serve.

---

## File / folder orientation

```
data-model/data-model/
├── README.md                              # What this repo is
├── AGENTS.md                              # (this file) primer for agents
├── CHANGELOG.md
├── package.json, eslint.config.mjs, etc.
│
├── definitions/                           # THE SOURCE OF TRUTH
│   ├── items/*.yaml                       # Health data point definitions (~73 items across ~11 YAML files)
│   ├── streams/*.yaml                     # Clinical-domain tree (~36 streams)
│   ├── eventTypes/
│   │   ├── eventTypes-hds.json            # Custom HDS event type JSON Schemas (~33)
│   │   └── eventTypes-legacy.json         # Standard Pryv measurement types (~200)
│   ├── converters/
│   │   ├── cervical-fluid/                # 9D vector converter (15+ charting methods)
│   │   └── mood/                          # 5D vector converter (5 methods)
│   ├── appStreams.yaml                    # App-contextual sub-streams (notes, chat)
│   ├── datasources/                       # External data source references
│   ├── conversions/                       # Unit conversions (mass, length, temperature)
│   ├── settings/settings.yaml             # HDS user-settings definitions
│   ├── hl7-defaults/category.yaml         # FHIR default categories
│   └── inputs.yaml                        # Input-type coercion map
│
├── src/
│   ├── items.js                           # Loader + checkItemVsEvenType validator
│   ├── streams.js                         # Stream loader
│   ├── eventTypes.js                      # EventType registry loader
│   ├── appStreams.js                      # App-stream loader
│   ├── converters.js                      # Converter loader
│   ├── datasources.js                     # Datasource loader
│   ├── conversions.js                     # Unit conversion loader
│   ├── settings.js                        # Settings loader
│   ├── build.js                           # Pack generation (writes dist/pack.json)
│   └── schemas/items.js                   # AJV JSON Schema for item YAML structure
│
├── documentation/                         # Design notes, per-domain references
│   ├── DESIGN-NOTES.md                    # Item design principles (+ scale hook placement)
│   ├── SYMPTOMS.md                        # Symptom domain, Apple HealthKit mapping, decisions
│   ├── MOOD.md                            # Mood converter design, circumplex/PAD model
│   ├── CERVICAL-POSITION.md               # 3D vector design
│   ├── MENSTRUAL-CYCLE.md                 # Cycle modeling
│   ├── PHYSICAL-ACTIVITY.md               # Activity items
│   └── SKIN.md                            # Skin observations
│
├── scripts/                               # setup / deploy shell scripts
├── tests/                                 # Vitest test suite
└── dist/                                  # Generated pack.json + gh-pages clone (git-managed)
```

---

## Cross-system reference library

Commonly-cited scales / terminologies for mapping new items:

### Severity / intensity
- **ICF qualifier** (WHO) — 5 levels (0–4): No problem / Mild / Moderate / Severe / Complete.
- **Apple HealthKit `HKCategoryValueSeverity`** — 4 levels: NotPresent / Mild / Moderate / Severe.
- **PROMIS Short Forms** — many 5-level Likerts (Physical Function, Pain Intensity, Emotional Distress – Anxiety, Emotional Distress – Depression, etc.).
- **VRS-5 / VRS-4** — verbal rating scales for pain and other severities.
- **NRS 0–10** — numeric rating scale, clinical pain gold standard (LOINC 72514-3).

### Function / disability
- **ICF d-codes** — `d450` walking, `d510` washing, `d540` dressing, `d630-d649` household, `d845-d859` work, `d920` recreation.
- **WHODAS 2.0** — 6 domains, 5-level Likert.
- **Katz ADL**, **Barthel Index** — binary/ordinal per-item ADL assessment.
- **SF-36 PF / RE / RP** — physical function and role functioning subscales.

### Mental health / distress
- **Kessler K6 / K10** — 6/10 items, combined psychological distress.
- **HADS** — 14 items, split anxiety (7) + depression (7).
- **PHQ-2 / PHQ-9** — depression (LOINC 75275-8 for PHQ-9 total).
- **GAD-2 / GAD-7** — anxiety (LOINC 69737-5 for GAD-7 total).
- **WHO-5** — positive wellbeing.
- **DASS-21** — depression / anxiety / stress.
- **Apple HealthKit `HKStateOfMind`** (iOS 17+) — valence + 38 emotion labels.

### Self-rated health
- **EQ VAS** — 0–100 mm (EuroQol).
- **SF-1 / SF-36 GH item 1 / PROMIS Global01** — 5-level (Excellent / Very good / Good / Fair / Poor).
- **NHIS / MEPS / ESS / SILC** — national health surveys, 5-level SRH question.
- SNOMED `425058002`; LOINC `72006-0`, `32622-6`, `82589-3`.

### Terminologies (codes to include in item references)
- **SNOMED CT** — https://bioportal.bioontology.org/ontologies/SNOMEDCT
- **LOINC** — https://loinc.org/
- **ICD-10 / ICD-11** — WHO
- **ICF** — WHO
- **ATC** (medications) — WHO

---

## Existing design decisions (load these before proposing related changes)

From `documentation/SYMPTOMS.md` (2026-03-17):

1. **Acne dual-source** — when a bridge exposes acne in both a skin field and a generic symptoms field, both map to the existing `body-skin-acne` item (reuse). Single item regardless of source.
2. **Anxiety/Stress in symptom arrays** — `wellbeing-mood` (5D vectors) captures *transient mood tags*. Validated **distress severity** ratings from PROs (K6/K10, HADS, GAD/PHQ, etc.) live in `wellbeing-mental-distress` / `-anxiety` / `-depression` (added in v1.3.0 alongside EQ-5D-5L). The two are different constructs and coexist.
3. **Increased appetite** — modeled as `nutrition-appetite` (`ratio/proportion`, 3 hooks).
4. **Weight fluctuations** — not a symptom; derived from body-weight.
5. **Stream hierarchy** — full clinical sub-categories under `symptom/`.

From `documentation/MOOD.md` (Plan 24, 2026-03-23):

- 5D vector space: valence / arousal / dominance / socialOrientation / temporalFocus.
- Converter engine: weighted Euclidean distance.
- Methods supported: multiple external vocabularies (Apple HealthKit, Daylio, How We Feel, third-party bridges) plus a direct `_raw` virtual method.

---

## Workflow expectations

- Work on a feature branch (`feature/<desc>` or similar), never directly on `main`.
- Run `npm run build` after YAML changes — the loader validates schema, stream/eventType references, and item↔eventType compatibility.
- Before committing changes touching `package.json`: `grep '"file:' package.json` (local-file dependencies must be replaced with git URLs before committing).
- `CHANGELOG.md` lives at the root; update under `[Unreleased]` when adding items / streams / eventTypes.
- The `dist/` folder is the `gh-pages` branch — deploys to `model.datasafe.dev`.

---

## Cross-repo relationships

This repo is the source of the HDS vocabulary. Other public repos consume `pack.json`:

- **[hds-lib-js](https://github.com/healthdatasafe/hds-lib-js)** — fetches `pack.json` via the platform service-info `assets.hds-model` URL, exposes items / streams / eventTypes / converters as `HDSModel`. See its [`AGENTS.md`](https://github.com/healthdatasafe/hds-lib-js/blob/main/AGENTS.md).
- **[hds-forms-js](https://github.com/healthdatasafe/hds-forms-js)** — React renderers for `HDSItemDef`. Implements the `slider`, `select`, `composite`, `convertible`, `datasource-search`, etc. field types declared on items here.
- **[app-data-model-browser](https://github.com/healthdatasafe/app-data-model-browser)** — small public viewer for the deployed `pack.json`.

When a change here breaks a consumer's typechecks (e.g. removing an option, renaming an item key), bump `version` in `package.json`, document under `[Unreleased]` in `CHANGELOG.md`, and notify the consumer repos.

---

*Living document — extend it whenever you uncover a non-obvious convention or an architectural decision worth memorising. The most recent entry in [`CHANGELOG.md`](CHANGELOG.md) is the canonical record of what shipped; this file captures the **why** behind the rules.*
