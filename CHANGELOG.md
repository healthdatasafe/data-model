# Changelog

## [2.2.0] - 2026-07-16

**Additive — the trying-to-conceive intake-questionnaire concepts** from
[healthdatasafe/site-agents#4](https://github.com/healthdatasafe/site-agents/issues/4). No renames or
removals. Loaded through hds-lib 1.3.1 via the consumer-check (286 items, no collision).

### Added — coded diagnosis & findings concepts (the #4 blocker)

- **`condition-coded`** — the diagnosis concept the model was missing. `datasource-search` against a new
  `condition` datasource (`datasets://condition`), eventType `condition/coded-v1`, stream `condition`.
  Records what a patient **has** (an established diagnosis), distinct from symptoms/procedures/treatments.
- **`finding-coded`** — coded clinical / imaging finding (`finding` datasource, `finding/coded-v1`, stream
  `finding`). What was **found** at surgery or on imaging — neither a procedure nor a diagnosis.
- Both are backed by **datasets-service 1.2.0** (`/condition` = 27 diagnoses, `/finding` = 11 findings,
  curated SNOMED-CT). The items ship here; the searchable corpus lives in datasets-service.

### Added — questionnaire items (all reuse existing event types)

- **Recalled averages** (§Q4): `fertility-cycles-average-peak-day`, `fertility-cycles-average-luteal-phase`
  — twins of the existing `-average-length` / `-average-period` (`time/d`, recalled summaries).
- **`symptom-pain-pelvic-severity`** — the severity-twin the form needs; `symptom-gastrointestinal-cramps`
  is GI, not pelvic. SNOMED `274671002` (Pelvic and perineal pain).
- **`profile-birthcountry`** — country of birth (`contact/country`), distinct from the address country.
- **`profile-ethnicity`** — self-identified ethnicity as a clinical/epidemiological variable
  (new `attributes/ethnicity` enum, OMB-aligned categories).
- **`fertility-tracking-method`** — the charting method/device in use (new `fertility/tracking-method-v1`
  enum: Billings, Creighton, Sympto-Thermal, Marquette, FEMM, Justisse, Peak-Day, Clearblue, Mira, Inito,
  Oura, Kegg). Determines how the person's cycle observations should be read.

## [2.1.0] - 2026-07-16

**Additive — 28 analytes + 5 reporting units.** No renames, no removals; every existing key and event
type is untouched, so nothing breaks on upgrade.

Delivers the analytes enumerated in
[healthdatasafe/site-agents#5](https://github.com/healthdatasafe/site-agents/issues/5) (follow-up to the
#2 domain): the fertility/reproductive-endocrine workup the first delivery had deferred.

### Added — 28 serum/blood analytes

- **Lipids (4):** total cholesterol, HDL, LDL, triglycerides (`concentration/mg-dl`).
- **Inflammation (2):** hs-CRP (`concentration/mg-l`); ESR (`rate/mm-h`, whole blood — placed under
  `body-blood` beside HbA1c, not in the serum subtree).
- **Thyroid (9):** free T4, total T3, reverse T3 (`concentration/ng-dl`); free T3 (`concentration/pg-ml`);
  TPO antibodies, thyroglobulin antibodies (`concentration/iu-ml`); thyroglobulin (`concentration/ug-l`,
  displayed ng/mL); TSI, TRAb (`concentration/iu-l`).
- **Reproductive & adrenal (13):** progesterone, prolactin (`concentration/ug-l`, displayed ng/mL);
  total testosterone, androstenedione, 17-OH progesterone, aldosterone (`concentration/ng-dl`); free
  testosterone (`concentration/pg-ml`); SHBG (`concentration/nmol-l`); DHEA-S, cortisol
  (`concentration/mcg-dl`); CA-125 (`concentration/u-ml`); PTH, ACTH (`concentration/pg-ml`).

All 28 SNOMED references are measurement-procedure concepts, verified ACTIVE against the local
`snomed-db` — the batch rejected 5 inactive top-of-search hits (total cholesterol, DHEA-S, CA-125 ×2,
TPO). TPO uses `27115008` *Microsomal thyroid antibody measurement* (the historical name for the same
assay; the dedicated TPO-Ab concepts are all inactive) — noted on the item.

### Added — 5 reporting-unit event types

`concentration/ng-dl`, `concentration/nmol-l`, `concentration/iu-ml`, `concentration/u-ml`, `rate/mm-h`.
Each proven non-equivalent to every existing same-dimension type per the `AGENTS.md` no-equivalent-twins
rule (all are genuine decade/scale differences, not silent duplicates of `iu-l` / `u-l` / `umol-l`).

### Added — `molar` pregnancy outcome

`pregnancy/detailed` (and the `fertility-pregnancy` item) gain a `molar` (hydatidiform mole) enum value,
inserted after `ectopic` — a distinct entity with its own hCG-surveillance follow-up. Requested in
[healthdatasafe/site-agents#4 §3.5](https://github.com/healthdatasafe/site-agents/issues/4). Purely
additive; existing pregnancy events are unaffected.

### Judgment calls (open to correction by the reporter)

- **CA-125 → `concentration/u-ml`**, not `catalytic-activity/u-ml`: the existing `catalytic-activity/u-l`
  is reserved for the liver *enzymes* (ALT/AST/GGT/ALP/LDH); CA-125's "U" is an arbitrary immunoassay
  unit, not catalytic activity.
- **TSI → `concentration/iu-l`** (assumed): the request left the unit blank. Modern immunoassays report
  IU/L; older bioassays report a % stimulation index — if needed, add it as a `variations.eventType`
  rather than retyping.

## [2.0.0] - 2026-07-15

**Major bump because item keys were renamed.** Stored data is unaffected, and **the old keys keep
working** — each is retained as a deprecated alias (below), so no consumer breaks on upgrade. The major
is for the eventual removal of those aliases and the `concentration/mg-ml` / `mcg-ml` removals.

Delivers the serum blood-chemistry domain reported in
[healthdatasafe/site-agents#2](https://github.com/healthdatasafe/site-agents/issues/2): **all 58
analytes the report enumerated**, across metabolic, minerals, vitamins, iron studies, CBC, renal &
electrolytes, protein, liver, methylation, thyroid and reproductive hormones. Design rationale:
[`documentation/BLOOD-CHEMISTRY.md`](documentation/BLOOD-CHEMISTRY.md).

### Changed — urine hormone item keys renamed (`fertility-hormone-*` → `body-urine-hormones-*`), old keys kept as aliases

**Nothing breaks on upgrade.** Stored data is unaffected (events carry `streamId` + `type`), and each
old key is retained as a **deprecated alias** with the same `streamId` and `eventType` — so it emits
identical events, `forKey` still resolves it, and consumers migrate on their own schedule. Aliases are
hidden from pickers (`getAllActive`).

| Old key | New key |
|---|---|
| `fertility-hormone-fsh` | `body-urine-hormones-fsh` |
| `fertility-hormone-hcg` | `body-urine-hormones-hcg` |
| `fertility-hormone-pdg` | `body-urine-hormones-pdg` |
| `fertility-hormone-e3g` | `body-urine-hormones-e3g` |
| `fertility-hormone-lh` | `body-urine-hormones-lh` *(old key kept, deprecated — see below)* |

**Why:** the old prefix matched neither the stream (`body-urine-*`) nor the specimen. Serum and urine
assays of the same hormone are different observations with different reference ranges — SNOMED codes
them as distinct procedures — so a neutral key that silently meant "urine" was a trap, and serum twins
had nowhere symmetric to live. Keys now equal their `streamId`, and the specimen is explicit on both
sides.

**Loader change enabling the aliases** (`src/items.js`): a deprecated item may now share a
`streamId:eventType` pair with an active one, and the **active** item owns the resolution index
regardless of load order — so `findItemForEvent` stays unambiguous. Two *active* items on one pair
still throw (the storage-identity invariant), as do two *deprecated* with no active (ambiguous).
Covered by tests `[ITMA-1..5]`; the rename-alias procedure is documented in `AGENTS.md`.

**Consumers should migrate at leisure** (`hds-react-timeline` already done):
- `doctor-dashboard` — `app/data/presets.ts`
- `bridge-mira` — `src/methods/hds4miraMethods.ts`, `_hds/manifest.json`, and
  `src/dataSync/converters/hormone.ts`, which builds the key by concatenation
  (`'fertility-hormone-' + hormone`). Without the aliases this would have thrown at **runtime** on the
  write path, with no typecheck to catch it.

**Aliases are removed once the consumers are updated.**

### Deprecated — `fertility-hormone-lh` (was typed `concentration/mg-l`)

LH is reported in **IU/L**; this item was the only one in the model using `mg-l`, while its siblings all
used `iu-l`. **Stored numbers are already correct** — `bridge-mira` writes Mira's value verbatim and
Mira reports LH in mIU/mL, which is numerically identical to IU/L. Only the type label was wrong.

It cannot be retyped in place: existing events carry `type: concentration/mg-l`, and the data lives in
users' own accounts, so there is nothing for HDS to migrate. The item is kept with `deprecated: true` so
those events still resolve and render; new data uses `body-urine-hormones-lh` (`concentration/iu-l`).

### Added — blood chemistry: `body-blood` tree + 58 analytes

New stream tree `body-blood`, following the existing specimen-rooted pattern (`body-urine`,
`body-semen`), with three specimen subtrees:

- **`body-blood-serum/`** — serum/plasma analytes (most of the domain)
- **`body-blood-cbc/`** — whole-blood counts
- **`body-blood-rbc/`** — erythrocyte specimen (`body-blood-rbc-magnesium`, distinct from
  `body-blood-serum-magnesium` — a different observation, not a different unit)
- **`body-blood-hba1c`** — whole blood, hence the direct placement

| Panel | Items |
|---|---|
| Metabolic | fasting glucose (mg/dL + mmol/L), fasting insulin, HbA1c, C-peptide |
| Iron studies | ferritin, iron, TIBC, transferrin saturation |
| CBC | hemoglobin, hematocrit, RBC, WBC, platelets, MCV, MCH, RDW, and the 5-part differential |
| Liver | ALT, AST, GGT, ALP, LDH, total bilirubin, bile acids |
| Renal & electrolytes | BUN, creatinine, eGFR, sodium, potassium, chloride, CO2, calcium |
| Protein | total protein, albumin, globulin |
| Minerals | zinc, copper, ceruloplasmin, magnesium (serum + RBC), selenium |
| Vitamins | A, D (25-OH), D (active), B12, folate, B6, C |
| Methylation | homocysteine |
| Thyroid | TSH |
| Reproductive | FSH, LH, estradiol, **AMH** |

Fasting glucose is its own item rather than a variation — SNOMED codes fasting (`167087006`) and random
(`167086002`) serum glucose as different procedures, and `variations` supports `eventType` only.
Precedent: `body-temperature-basal`.

**Codes.** All SNOMED references verified active against `snomed-db` (International RF2 20260201) —
this caught several inactive concepts that a plain search returns first (`35170002` Hemoglobin
determination, `142831004` RBC count, `165701004` RDW, `143134000` transferrin saturation). Three items
carry **no** SNOMED ref because no concept exists: `body-urine-hormones-e3g`, `body-urine-hormones-pdg`
and `body-blood-rbc-magnesium`. LOINC is **not asserted** — there is no local source to verify against,
so candidates stay in comments (precedent: `body-semen-morphology-normal`).

**Reference ranges are deliberately absent** — they vary by lab, assay and population, and "optimal"
bands are a practice's interpretation. The model carries the measured value; interpretation stays with
the interpreter.

**⚠️ `body-blood-pressure` is a vital sign and a sibling of `body-blood`, not a child** — despite the
shared prefix. Nothing resolves by prefix, so it is safe, but "all `body-blood` data" does not cover it.

### Added — units for the serum blood-chemistry domain

Foundation for the serum blood-chemistry domain (~68 analytes). Units land first: an
analyte can't be modelled honestly without one, and several conventional reporting units
had no home.

- **`concentration/gigacount-ml`** (10⁹ counts/mL) — RBC stores 4.3–4.8, as printed.
  Sibling of `concentration/megacount-ml`, which keeps WBC and platelets (× 10⁹/L ≡
  × 10⁶/mL); the split mirrors how lab reports print the two.
- **`concentration/mcg-dl`** (μg/dL) — serum zinc, copper, retinol, iron, TIBC.
- **`concentration/pg-ml`** (pg/mL) — B12, active vitamin D, estradiol.
- **`concentration/uiu-ml`** (μIU/mL) — fasting insulin, TSH.
- **`concentration/umol-l`** (μmol/L) — homocysteine, bile acids.
- **`catalytic-activity/u-l`** (U/L) — ALT, AST, GGT, ALP, LDH.
- **`volume/fl`** (fL) — MCV. **`mass/pg`** (pg) — MCH.
- **`rate/ml-min-173m2`** (mL/min/1.73m²) — eGFR.

Reused rather than added: `concentration/mg-dl`, `g-dl`, `ug-l`, `mmol-l` (legacy) and
`concentration/megacount-ml`.

### Changed — `ratio/proportion` also covers objective measured fractions

Its description previously scoped it to *subjective* scales with option-defined hooks.
Lab percentages (HbA1c, hematocrit, RDW, transferrin saturation, the WBC differential)
are genuine fractions, so they store here as `0..1` — never as `42` — and render via
`display.multiplier`. The `0..1` bound is enforced, and fractions match Apple HealthKit's
`HKUnit.percent()`; FHIR/LOINC export applies the × 100 in the mapper.

### Added — `number.display` on number items

`type: number` items accept an optional `number.display` block (`multiplier` /
`precision` / `suffix`), mirroring `slider.display`. Storage stays raw; the user sees the
conventional scale (`0.42` → `42%`). Requires hds-forms-js ≥ the matching release.

### Removed — two eventTypes equivalent to legacy Pryv types

`concentration/mg-ml` (≡ legacy `concentration/g-l`) and `concentration/mcg-ml` (≡ legacy
`concentration/mg-l`) were HDS-added alongside twins that already existed. Equivalent
types split the same measurement across two names, invisibly to any validator. Both were
referenced by zero itemDefs and zero consumers, so removal is clean.

**New rule in `AGENTS.md`:** a new eventType must never be numerically equivalent to an
existing one — do the arithmetic, don't compare the names. Where the twin is a legacy
type, the legacy type wins.

### Changed — `AGENTS.md`: `description` is short, end-user text

Item `description` is rendered under the field label to patients and clinicians. One
short sentence; no storage detail (`Stored as a 0..1 ratio`), assay minutiae, or
rationale — those belong in `devNotes` or `documentation/`.

## [1.12.1] - 2026-07-06

### Fixed — SNOMED code corrections + newly-coded concepts (verified via snomed-db)

Audited every symptom/BP SNOMED reference against **SNOMED International RF2 20260201** using the
`snomed-db` tool. Corrected codes that shipped in 1.11.0/1.12.0 as **inactive or nonexistent** (they
came from a stale reference table):

- `symptom-gastrointestinal-nausea`: `73879007` (inactive) → **`422587007`** (Nausea).
- `symptom-gastrointestinal-bloating`: `248490000` (inactive) → **`116289008`** (Abdominal bloating).
- `symptom-cognitive-focus-difficulty`: `76039006` (nonexistent) → **`26329005`** (Poor concentration).
- `symptom-bleeding-nosebleed`: `12441001` (inactive disorder) → **`249366005`** (Bleeding from nose).
- `symptom-thermoregulation-hot-flashes`: `70882005` (nonexistent) → **uncoded** (no active finding-level concept; the "Hot flush/flashes" findings are all inactive).

Added SNOMED references to the 7 §2 concepts that shipped uncoded (all verified active findings):
`skipped-beat` `248629002`, `excessive-sweating` `52613005`, `cold-extremities` `[271584002, 271585001]`
(Cold hands + Cold feet — no active single "cold extremities" concept), `hearing-difficulty` `162340000`,
`bleeding-gums` `86276007`, `easy-bruising` `424131007`, `twitching` `82470000`.

## [1.12.0] - 2026-07-06

### Added — new symptom domains (Plan 77 / #19 §2)

28 new symptom concepts across 8 domains, each as a **live** occurrence (`activity/plain`) + severity (`ratio/proportion`, 5-level) twin on one `streamId`, en+fr. Unlike §1's existing items, the occurrence twin is **not** deprecated — greenfield concepts keep presence-only logging valid.

- **New categories:** respiratory (cough, shortness of breath, wheezing, nasal congestion, sore throat, runny nose), cardiac (palpitations, skipped heartbeat), thermoregulation (chills, hot flashes, night sweats, excessive sweating, cold extremities), vision & sensory (blurred vision, visual disturbance, hearing difficulty), hydration & urinary (excessive thirst, frequent urination), bleeding (nosebleed, bleeding gums, easy bruising).
- **Extended:** neurological (+ tingling/numbness, tremor, restless legs, muscle twitching), dermatological (+ rash, hives, itching).
- 56 items + 28 streams in `definitions/items/symptom-domains.yaml`. No new eventType.
- SNOMED references on 21/28 concepts; **7 pending code verification** (`skipped-beat`, `excessive-sweating`, `cold-extremities`, `hearing-difficulty`, `bleeding-gums`, `easy-bruising`, `twitching`).

## [1.11.0] - 2026-07-06

### Added — intensity/severity items + blood pressure (Plan 77 / #19)

Addresses [data-model#19](https://github.com/healthdatasafe/data-model/issues/19) (MSQ symptom-screening integration), §1 + §4.

- **Activity intensity** (§1): each of the 9 `activity-*` occurrence items is marked `deprecated: true` and paired with a new `activity-*-intensity` item on the same `streamId` — `ratio/proportion`, WHO/ACSM 3-level (`0.25` Light / `0.5` Moderate / `1.0` Vigorous), en+fr.
- **Symptom severity** (§1): each of the 19 presence `symptom-*` items is marked `deprecated: true` and paired with a new `symptom-*-severity` item on the same `streamId` — `ratio/proportion`, 5-level (`0 / 0.25 / 0.5 / 0.75 / 1.0` = None/Slight/Moderate/Severe/Extreme), en+fr, SNOMED references carried from `documentation/SYMPTOMS.md`. 4-level sources (Apple `HKCategoryValueSeverity`, Mira `level`, MSQ 0–3) map as a subset by label.
- **Blood pressure** (§4): new `body-blood-pressure` stream (under `body`) + composite item on the existing `blood-pressure/mmhg-bpm` eventType — `systolic` + `diastolic` (mmHg) + optional `rate` (pulse, bpm). SNOMED/LOINC references.
- **No new eventType** introduced (reuses `ratio/proportion`, `activity/plain`, `blood-pressure/mmhg-bpm`). Existing occurrence events keep resolving via the deprecated twins — item identity is `streamId:eventType`, so two itemDefs coexist on one stream (same pattern as `body-vulva-mucus-inspect`).
- #19 §3 (generic instrument-item) and §5 (affect converters) are consumer-side — no model change. §2 (8 new symptom domains) planned as a follow-up.

## [1.10.3] - 2026-06-29

### Changed — shorten Billings/Creighton method display labels to bare family names

- `definitions/converters/cervical-fluid/models/billings/v0.json`: display name `Billings Observation` / `Observation Billings` → `Billings` (en+fr).
- `definitions/converters/cervical-fluid/models/creighton/v0.json`: display name `Creighton Model` / `Modèle Creighton` → `Creighton` (en+fr).
- Method ids `billings` / `creighton` unchanged. Mirrors the `model: trademark naming alignment` rename in `model-cervical-fluid` (b401488), keeping the published model labels consistent with the standalone model package.

## [1.10.2] - 2026-06-23

### Changed — Billings method display label (avoid protected trademark)

- `definitions/converters/cervical-fluid/models/billings/v0.json`: renamed the display name from `Billings (BOM)` / `Billings (MOB)` to `Billings Observation` (en) / `Observation Billings` (fr), dropping the registered marks "Billings Ovulation Method" / BOM / MOB. Method id `billings` unchanged. Mirrors the same rename in `model-cervical-fluid`.

## [1.10.1] - 2026-06-22

### Fixed — composite↔eventType nesting + validation (B-2026-06-12-1)

- `medication-intake-basic` composite now nests `doseValue` / `doseUnit` / `route` under an `intake` sub-object, matching the `medication/basic` eventType (and aligning with `medication/coded-v1` + FHIR `dosage`). Previously the composite renderer emitted these flat, producing stored event content that violated its own declared eventType.
- `src/schemas/items.js`: item schema extended with a recursive `compositeField` definition so a composite field can itself be `type: composite` (nested groups).
- `src/items.js`: implemented the previously-stubbed composite↔eventType validation in `checkItemVsEvenType` — recursively checks that every composite field maps to a compatible eventType property (type + enum), catching shape/enum drift at build time. Replaces the `XX Composite type TODO` no-op.
- Tests: `tests/items.test.js` ITMC1-4 (nested shape present, valid composite passes, flat-shape rejected, out-of-enum select rejected).
- Backward compatibility: existing flat events are not migrated; consumers read both shapes (see hds-lib `eventToShortText`).

## [1.10.0] - 2026-06-16

### Added (plan 71 Phase B — questionnaire request/answer event pair)
- New eventType `questionnaire/request-v1` in `eventTypes-hds.json`. Doctor → patient: a questionnaire instantiated for this patient with a `questions` map keyed by stable question keys. Each question carries `label`, `itemRef` (existing HDS item key), optional `params` (entity filter — e.g. drug codes), required temporal `scope` (`ever` / `window` with `withinDays` / `latest` with `withinDays`), and optional `subField` (`select-segmented` / `text` / `number`) for qualifier capture. Question keys constrained to Pryv content-query path grammar `[a-zA-Z0-9_-]+` (no colons, dots, brackets) so `content.answers.<key>.status` queries work against the matching answer event.
- New eventType `questionnaire/answer-v1` in `eventTypes-hds.json`. Patient → doctor: response to a `questionnaire/request-v1`, linked via `requestEventId`. `answers` map keyed by the same question keys; each entry carries a `status` enum (`answered` / `no` / `unknown` / `declined`) with conditional fields per status: `answered` requires non-empty `references[]` (eventIds of typed events that satisfy the question) and allows optional `qualifier` (any shape per the request's subField); `declined` allows optional `reason` (free-text string, coded values deferred to additive extension). Key absence = implicit "not-answered". JSON Schema uses `oneOf` discriminator on `status` with `additionalProperties: false` per branch — invalid status enum values, references on `no`/`unknown`/`declined`, and missing references on `answered` all reject.
- New documentation file `documentation/QUESTIONNAIRE.md` capturing the two-layer model (template/asking + storage in typed events), the `clientData.related.<eventId>: true` keyed-object cross-reference convention (Pryv §7) that writers MUST mirror into for cohort queryability via the indexed `clientData` parameter, atomicity convention (`events.batch` for answer + new typed events; references immutable post-write), update semantics (new event per edit, latest-by-`event.time` wins for prefill), FHIR mirror table (`Questionnaire` / `QuestionnaireResponse` with `answer.reference` and `data-absent-reason` for the negative statuses), and HDS precedents (Plan 45 `message/system-alert`↔`message/system-ack` request/response pair; Plan 53 D3 context-via-substream for per-context isolation).
- Tests in `tests/questionnaire.test.js` (32 new cases) covering eventType registration, Pryv key-grammar enforcement on both maps, request schema (scope variants, subField shapes, additionalProperties rejection), and answer schema (per-status discriminator, references presence/absence rules, qualifier shape, reason on declined).

### Notes
- No new item type added in this release. The questionnaire is a top-level form artifact rendered by hds-forms-js (Plan 71 Phase C), not a field-on-an-item. `src/schemas/items.js` and `src/items.js` are untouched.
- No new per-domain assertion eventTypes — explicit-no/unknown/declined semantics live entirely on `questionnaire/answer-v1`. Cost: "no" answers have no standalone typed clinical record; FHIR `MedicationStatement.status=not-taken` exports are derived at the consumer from the answer event. Plan 71 Decision D8 (2026-06-15).
- The composite item↔eventType validation TODO in `src/items.js` is still deferred to a dedicated data-model session (`_plans/BUGS.md` B-2026-06-12-1) — unrelated to this plan and untouched.

## [1.9.1] - 2026-06-04

### Added (plan 53 phase A — `role: context` flag on context streams)
- New optional `role` field on stream definitions. v1 value: `context`. A `role: context` stream exists purely as a descendant-streamId marker for the D3 context-via-substream mechanic (see `documentation/TREATMENT-PROCEDURE.md`); no itemDef is registered there and consumers should treat it as metadata, not as a data-bearing bucket.
- `treatment-fertility` and `procedure-fertility` tagged `role: context`. Implicit default for all other streams is "data" (no declaration required).
- Field flows through `dist/streamsTree.json` and `pack.json` unchanged — `src/streams.js` parses YAML and re-emits the stream node verbatim; no schema/validation update needed.
- Non-breaking: existing consumers that don't know about `role` ignore unknown fields. Runtime helpers (`hds-lib-js#isContext()`), forms-engine rendering, and webapp/dashboard visual treatment are tracked separately under Plan 53 Phase B.

### Added (STORMM coherence — new `count/mega` eventType)
- `count/mega` eventType registered in `eventTypes-hds.json` — "Millions of units count." Symbol `M#`, label "Megacounts" / "Mégacomptes". Companion to the existing `concentration/megacount-ml`; the stream context defines what is being counted.
- `body-semen-tmc.eventType` retagged from `count/generic` to `count/mega`. The item description already documented megacount storage convention (10⁶ sperm); the new eventType makes the magnitude explicit at the schema layer so external consumers (HL7/FHIR export, third-party converters) interpret values correctly.

### Changed (STORMM coherence — `version: temporary` → `v1` promotions)
- `body-weight`, `body-height`, `fertility-cycles-start`, `fertility-cycles-peak-day` promoted to `version: v1`. All four are de-facto stable (used by every HDS app + multiple bridges); the `temporary` flag had not been updated since their introduction. No schema change.

## [1.9.0] - 2026-06-03

### Added (plan 70 phase E — `tilt` dimension on cervix-position)
- `body-vulva-cervix-position` item bumped `version: v1` → `v2`. Adds an optional fourth composite dimension `tilt` (Straight / Medium / Tilted → 0.0 / 0.5 / 1.0). Position-only (not a fertility signal); RYB-originated — no clinical-coding convention. Old events read identically (eventType name unchanged); new events may carry the optional field.
- `cervix-position/3d-vectors` eventType schema extended with optional `tilt` property (range 0–1). Existing height/firmness/openness unchanged. Description updated to flag tilt as position-only.
- `documentation/CERVICAL-POSITION.md` — Read Your Body added to the value-vocabulary table as the only system surveyed that tracks tilt; new section on the v1→v2 additive extension; tilt row added to the HDS model summary.

## [1.8.1] - 2026-04-30

### Changed (plan 46 — use Pryv-native event.time + event.duration for treatment span)
- `treatment/basic` and `treatment/coded-v1` eventType payload schemas no longer carry `period: { start, end }`. The treatment span is now expressed via Pryv's native event fields: `event.time` = treatment start, `event.duration` = span in seconds (omitted for ongoing / unbounded). Descriptions updated.
- `procedure/basic` and `procedure/coded-v1` eventType payload schemas no longer carry `performed: { date }`. Procedure timestamp uses `event.time` natively; procedures are point-in-time (no `event.duration`).
- `treatment-basic` and `treatment-coded` items declare `duration: { mandatory: false, canBeNull: true, maxSeconds: 315360000 }` (10-year cap) — matching the convention used by `fertility-cycles-start`, `fertility-cycles-fertile-window`, `fertility-pregnancy`. Procedure items intentionally omit the `duration` block since they're point-in-time.

### Notes
- Non-breaking change: `period` and `performed` were both optional and never required by clients; existing events that contain them still validate (JSON-schema defaults to `additionalProperties: true`). New writers should target the Pryv-native fields instead.
- Trigger: the `datasource-search` companion-fields renderer in hds-forms-js auto-generated plain-text Start / End inputs from the previous `period.{start,end}` payload schema. User vetoed shipping those text-only inputs; canonical Pryv mapping (`event.time` + `event.duration`) is the right place. Form-engine duration UI is a separate future plan; Plan 46 forms today omit `event.duration` (= point-in-time / Flavour A).

### Added (plan 46 — documentation)
- `documentation/TREATMENT-PROCEDURE.md` — canonical reference for the new subdomains, the basic+coded item pair, the procedure findings array, and the **context-via-substream resolution mechanic (D3)** with a worked STORMM IVF intake example, the cross-tree context naming convention, and FHIR / SNOMED / LOINC cross-walk.
- `documentation/TAGS.md` — deferred-design reference for the future `tags/` root: `tags/hds/*` controlled vocabulary + `tags/user/*` custom namespace, never `streamIds[0]`. Captures rationale, use cases, and integration points so a follow-up plan can pick it up without revisiting the design.

## [1.8.0] - 2026-04-30

### Added (plan 46 — treatment & procedure subdomains + context-via-substream)
- Two new top-level streams in `definitions/streams/`: `treatment.yaml` (`treatment` parent + `treatment-fertility` context child) and `procedure.yaml` (`procedure` parent + `procedure-fertility` context child).
- Four new itemDefs in `definitions/items/`: `treatment-basic`, `treatment-coded` (both registered at `treatment`); `procedure-basic`, `procedure-coded` (both registered at `procedure`). Mirrors the existing `medication-intake-basic` / `medication-intake-coded` pair pattern; the basic+coded duo is the v1 surface for both subdomains, with no per-domain named-leaf items.
- Four new eventTypes in `definitions/eventTypes/eventTypes-hds.json`: `treatment/basic`, `treatment/coded-v1`, `procedure/basic`, `procedure/coded-v1`. Treatment payloads carry `name` / `regimen.{label,codes}`, optional `count` (Flavour A), optional `period.{start,end}` (Flavour B). Procedure payloads carry `name` / `procedure.{label,codes}`, optional `performed.date`, optional `count`, an open-vocabulary `findings[]` array, and `notes`.
- Two new datasource declarations in `definitions/datasources/`: `treatments.yaml` and `procedures.yaml` exposing `datasets://treatment` and `datasets://procedure` for the coded variants. Datasets-service implementations land in Slice 2.
- Helpers in `src/streams.js`: `getAncestorsById(id)` returns the chain `[id, parent, …, root]`; `isDescendantOf(candidate, ancestor)` validates context membership.
- `findItemForEvent(eventType, streamId)` in `src/items.js` — implements the **context-via-substream resolution rule (D3)**: direct `(streamId, eventType)` match first; on miss, walk parents until the closest ancestor with a registered itemDef matches.

### Notes
- Same closest-ancestor walk-up algorithm as `hds-lib-js` Plan 45 (`resolveStream.ts` clientData lookup) and `HDSModelAuthorizations` (parent-covers-child de-dup) — D3 is the third application of the same principle, applied at the data-model itemDef layer.
- `streamId` schema stays singular. Multi-streamId tagging is reserved for the future `tags/` root (deferred per Plan 46 §2.9, documentation only).

## [1.7.0] - 2026-04-28

### Added (plan 52 — hds-react-timeline integration in hds-webapp)
- New app-stream declaration `webapp-settings` in `definitions/appStreams.yaml` (`suffix: webapp-settings`, `eventType: settings/hds-react-timeline`). Resolves under any client app's `appStreamId` (e.g. for hds-webapp: `app-client-dr-form-webapp-settings`). Holds one event per feature, distinguished by `eventType` (e.g. `settings/hds-react-timeline`); single recurring event per type, updated in place. Display category `system`.

## [1.6.0] - 2026-04-28

### Added (plan 45 — custom fields & system stream in appTemplates)
- Two new event types in `definitions/eventTypes/eventTypes-hds.json` for the system-stream feature:
  - **`message/system-alert`** — operator → user notification carrying `{ level: 'info'|'warning'|'critical', title, body, ackRequired?, ackId? }`. Used on the account-level `app-system-out` stream.
  - **`message/system-ack`** — user → operator acknowledgement carrying `{ ackId, ackedAt, userNote? }`, paired with its originating alert by `ackId`. Used on `app-system-in`.
- Two new app-stream declarations in `definitions/appStreams.yaml`: `system-out` (eventType `message/system-alert`) and `system-in` (eventType `message/system-ack`). These describe the account-level system-stream pair provisioned once by the user's HDS-aware client app.
- New `documentation/CUSTOM-FIELDS-AND-SYSTEM.md` covering the data-model perspective: which eventTypes are reused for custom fields (none new — `note/txt`, `note/html`, `activity/plain`, `date/iso-8601`, `count/generic`), the two new `message/*` impls for system streams, and pointers to the runtime mechanics in `hds-lib-js`.
- Tests in `tests/customFieldsAndSystem.test.js` covering the new eventTypes, appStream declarations, and pack.json registration.

### Notes
- **No new eventTypes for custom fields.** Templates' `customFields[]` declarations carry their typing inline on each stream's `clientData.hdsCustomField[<eventType>]`, reusing the existing storage-shape eventTypes. The runtime parent-chain validator walk lives in `hds-lib-js` (Plan 45 Phase 3).
- **No `data-model/src/items.js` changes.** That file is a build-time loader for canonical item definitions; runtime validation against `clientData.hds*` declarations is a `hds-lib-js` concern.

## [1.5.0] - 2026-04-28

### Added (plan 50 — deprecated itemdef policy)
- `deprecated: { type: 'boolean' }` (optional) recognised in `src/schemas/items.js`. Round-trips through `pack.json`.
- Contract documented in `AGENTS.md` § "`deprecated: true` on items": flag means item is kept (existing events keep validating + rendering) but not used for new data points. Consumer apps MUST filter deprecated items out of discovery / picker UIs (form builders, item picker sheets, data-model browser); the resolution layer (`itemsDefs.forKey` / `forEvent`) MUST still return deprecated items so readers can render existing events.

## [1.4.0] - 2026-04-28

### Added (plan 48 — cyclefeminin import)
- `body-vulva-mucus-inspect-count` (`count/generic`, `repeatable: once`) — companion item in the `body-vulva-mucus-inspect` stream that captures the daily count of cervical-fluid self-observations. Creighton FertilityCare protocol mandates this count alongside the most-fertile observation of the day; reusable across any future Creighton/FertilityCare/Billings importer or app.
- `deprecated: true` flag added to three items (`body-vulva-mucus-stretch`, `body-vulva-wetness-feeling`, `fertility-cycles-charted-count`) — flag-only at this stage; formal contract (schema validation, `pack.json` surfacing, consumer-app handling) tracked under plan 48 phase 6.

## [1.3.2] - 2026-04-27

### Changed
- `wellbeing-self-rated-health` slider gains `display.suffix: { en: "/100", fr: "/100" }` so the EQ VAS readout, ARIA `aria-valuetext`, and the diary list (via `eventToShortText`) all show `"73 /100"` instead of just `"73"` or the raw `"0.73"`. Storage unchanged (raw 0..1 ratio/proportion).

## [1.3.1] - 2026-04-27

### Changed
- Item descriptions trimmed to short, patient-facing text (no spec/scale/instrument leakage). Affects `wellbeing-self-rated-health`, `wellbeing-mental-distress*`, `function-mobility`, `function-self-care`, `function-usual-activities`, `symptom-pain-severity`, `body-vulva-cervix-position`, `body-vulva-menstrual-cup`, `fertility-cycles-average-length`, `fertility-cycles-average-period`, `profile-avatar`. Full clinical/spec context retained in `documentation/` and per-item `references:` blocks.

## [1.3.0] - 2026-04-24

### Added (plan 44 — EQ-5D-5L PRO integration)
- New `function/` top-level stream with children `function-mobility`, `function-self-care`, `function-usual-activities` (ICF Activities & Participation — `d450`, `d510`/`d540`, `d630`/`d845`/`d920`).
- New items on the canonical 5-level severity scale (`ratio/proportion` with hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`):
  - `function-mobility`, `function-self-care`, `function-usual-activities` — EQ-5D-5L D1–D3, WHODAS, SF-36 PF, PROMIS Physical Function, Barthel, Katz.
  - `symptom-pain-severity` (new child under existing `symptom-pain`) — overall pain intensity (VRS-5 / NRS / PROMIS Pain Intensity / SF-36 BP compatible).
  - `wellbeing-mental-distress` (combined), `wellbeing-mental-distress-anxiety`, `wellbeing-mental-distress-depression` — covers EQ-5D-5L D5 (combined), K6/K10, WHO-5 inverse, plus splitting PROs GAD/PHQ/HADS/DASS-21/PROMIS.
- `wellbeing-self-rated-health` — EQ VAS / SF-36 GH / PROMIS Global01 / SF-1 / NHIS-MEPS SRH. Uses new `type: slider` with `display.multiplier: 100` (raw 0..1 storage, 0..100 shown).
- **New `type: slider` field type** on the item schema — numeric input with `min`, `max`, `step`, optional `slider.{orientation, labels, display{multiplier, precision, suffix}}`. Enables VAS-style inputs and any bounded-range slider UI, separating storage (raw value) from display (multiplier/precision/suffix). Validator accepts slider for any numeric eventType.
- `documentation/DESIGN-NOTES.md` — new "Scale hook placement" subsection: `ratio/*` hooks must match semantic anchors of competing scales (ICF, EQ-5D, PROMIS, HealthKit), not even distribution. Canonical placements for 5-level, 4-level (subset), 3-level, 11-level severity families.
- `documentation/FUNCTION.md` — companion doc for the new `function-*` domain covering ICF alignment, WHODAS/EQ-5D/PROMIS/SF-36/Katz/Barthel mappings, and design decisions.
- `AGENTS.md` (repo root) — primer for future agents covering architectural principles, the scale-hook rule, reuse-first examples, anti-patterns, file orientation, and cross-system reference library.

### Changed (plan 44)
- `documentation/SYMPTOMS.md` severity-mapping table: Apple HealthKit 4-level placement updated from `0.0 / 0.33 / 0.66 / 1.0` (even distribution) to `0.0 / 0.25 / 0.5 / 1.0` (subset of the 5-level canonical scale). Not a breaking change — the severity extension was never implemented. Round-trip analysis in plan 44 research notes.
- `documentation/SYMPTOMS.md` decision #2 split into "transient mood tags" (→ `wellbeing-mood`, unchanged) vs "validated distress-severity ratings" (→ the new `wellbeing-mental-distress*` items). Hybrid sources (Mira's `symptoms.Anxiety` with optional `level`) map to the severity items.

### Added (earlier, prior to plan 44)
- Body temperature stream (`body-temperature`) and `body-temperature-basal` item (`temperature/c`) — basal body temperature for fertility charting.
- `body-vulva-menstrual-cup` item under `body-vulva` stream (`ratio/proportion`, light/moderate/heavy fill levels).
- Cognitive symptom stream (`symptom-cognitive`) and `symptom-cognitive-focus-difficulty` item — difficulty concentrating (SNOMED CT 76039006).
- `symptom-pain-muscle` item under existing `symptom-pain` stream — muscle / joint pain.
- `fertility-cycles-average-length` and `fertility-cycles-average-period` items (`time/d`, `repeatable: once`) — profile-level cycle/period length metrics.

All new items added in support of the FEMM bridge (plan 33).

## [1.2.0] - 2026-03-23

### Changed
- Convertible eventType schemas (`mood/5d-vectors`, `vulva-mucus-inspect/9d-vector`): content now uses `{ vectors, source? }` wrapper with documented source provenance block
- `medication-intake-basic` v3: `doseUnit` changed to select (9 options: tablet, drop, puff, mg, μg, ml, etc.), `route` changed to select (13 options: oral, sublingual, topical, IV, IM, SC, etc.). All labels localized (en + fr).

## [1.1.0] - 2026-03-19

### Added
- Converter engine definitions for cervical-fluid (11 methods, 9 dimensions) and mood (2 methods, 5 dimensions)
- Build pipeline for `dist/converters/` output (pack.json, per-item index.json and pack-latest.json)
- New eventType `vulva-mucus-inspect/9d-vector` for 9D vector observations
- `convertible` item type support in schema validation

### Changed
- `body-vulva-mucus-inspect` itemDef: type `convertible` with converter-engine block
- `wellbeing-mood` itemDef: type `convertible` with converter-engine block
- Deprecated `vulva-mucus-inspect/v0` eventType

## [0.5.0] - 2026-03-17

### Added
- Physical activity stream, items, and cross-system documentation
- Postpartum and miscarriage bleeding items under body-vulva-bleeding
- Expanded symptom model with clinical categories
- Nutrition stream
- Cervical position cross-system research documentation
- Cervical position and mood composite items with `canBeNull` support
- Wellbeing stream with sex-drive item
- Profile-avatar and profile-display-name definitions
- Skin items (body-skin-*) and mood/skin research docs
- Symptom stream hierarchy and items for Mira daily log symptoms
- `ratio/proportion` event type
- `test-result/scale` event type, fertility test items (OPK, pregnancy)
- `protected` option for fertility-sexual-activity (Mira bridge)
- Settings definitions to data model
- Unit conversion compilation to build pipeline
- Reminder configs to item definitions
- `medication/prescription-v1` event type with frequency/times-period

### Changed
- Redesigned `medication/basic` event type
- Updated bleeding model
- Renamed setting event types to kebab-case for Pryv API compatibility
- Migrated repeatable values to ISO 8601 format
- Bumped Node engine to `>=24`

### Fixed
- Fixed profile-avatar: use variations instead of `picture/*` wildcard
- Fixed `localizeFields` recursing into displayFields
- Removed note field from `medication/coded-v1` intake

## [0.4.0] - 2026-02-27

### Added
- Data source medication intake definitions
- Better medication model

## [0.3.0] - 2026-02-12

### Changed
- Migrated linting to ESLint 9 + neostandard
- Adopted HDS style system: palette class, Google Fonts

### Added
- Event type definitions packaged for consumption

## [0.2.0] - 2026-01-23

### Added
- Urine hormones to index
- Fertility items (hormones, cycles)

### Changed
- Updated variations schema

## [0.1.0] - 2025-09-24

### Added
- Medication model (step 1)
- Item references from streams
- Stream listing HTML page
- Select possible values display
- Live birth to pregnancy model
- Bleeding and wetness/wiping items
- Form schema task

## [0.0.1] - 2025-05-26

### Added
- Initial release
- YAML-based health data model definitions
- Stream hierarchy with items
- JSON schema generation
- Test suite for model validation
- Documentation site with CNAME
- Body weight translations
